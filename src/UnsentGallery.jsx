import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import logo from './assets/fakelogo.png';
import './App.css';

function UnsentGallery() {
  const navigate = useNavigate();
  const [unsentList, setUnsentList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // stores the fileName of the item currently syncing
  const [isSyncing, setIsSyncing] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const user = JSON.parse(userData);
      setCurrentUser(user);
      loadUnsent(user.email);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const loadUnsent = async (userEmail) => {
    setIsLoading(true);
    try {
      const { value } = await Preferences.get({ key: 'unsent_catches' });
      if (value) {
        const parsedData = JSON.parse(value);
        // only show items created by the currently logged-in user
        const userSpecificData = parsedData.filter(item => item.userEmail === userEmail);

        const listWithImages = await Promise.all(
          userSpecificData.map(async (item) => {
            try {
              const file = await Filesystem.readFile({
                path: `unsent/${item.fileName}`,
                directory: Directory.Data,
              });
              // return base64 for previewing the image in the gallery
              return { ...item, displayImage: `data:image/jpeg;base64,${file.data}` };
            } catch (fileErr) {
              return { ...item, displayImage: null };
            }
          })
        );
        setUnsentList(listWithImages);
      }
    } catch (err) {
      console.error("Error loading unsent items:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async (item, isBulkSync = false) => {
    if (!currentUser) return;
    setIsSyncing(item.fileName);

    try {
      // prepare data, convert base64 back to binary for S3
      const response = await fetch(item.displayImage);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const credentials = {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY?.trim(),
      };
      const region = import.meta.env.VITE_AWS_REGION;
      const bucketName = import.meta.env.VITE_S3_BUCKET_NAME;

      const s3Client = new S3Client({ region, credentials });
      const dbClient = new DynamoDBClient({ region, credentials });
      const docClient = DynamoDBDocumentClient.from(dbClient);

      const s3Key = `${currentUser.email}/${item.fileName}`;

      // upload to S3
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: "image/jpeg",
      }));

      // trigger recognition Lambda
      const lambdaApiUrl = "https://gc2d5ks32a.execute-api.eu-west-1.amazonaws.com/default";
      const lambdaResponse = await fetch(lambdaApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: bucketName, key: s3Key })
      });

      const rawResult = await lambdaResponse.json();
      let fishData = rawResult.body ? 
        (typeof rawResult.body === 'string' ? JSON.parse(rawResult.body) : rawResult.body) 
        : rawResult;

      const fishSpecies = fishData.results?.[0]?.species?.[0]?.name || "unidentified fish";
      const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;

      // create DynamoDB Record
      await docClient.send(new PutCommand({
        TableName: "blueshuttle",
        Item: {
          "blueshuttle-partition": s3Key,
          imageUrl: s3Url,
          speciesName: fishSpecies,
          timestamp: item.timestamp,
          latitude: item.latitude, 
          longitude: item.longitude,
          userEmail: currentUser.email,
          username: currentUser.username,
          fishData: fishData 
        }
      }));

      // cleanup local storage ledger
      const { value } = await Preferences.get({ key: 'unsent_catches' });
      const allParsed = value ? JSON.parse(value) : [];
      const filteredMaster = allParsed.filter(i => i.fileName !== item.fileName);

      await Preferences.set({
        key: 'unsent_catches',
        value: JSON.stringify(filteredMaster)
      });

      // delete physical file from device
      await Filesystem.deleteFile({
        path: `unsent/${item.fileName}`,
        directory: Directory.Data
      });

      // update UI state
      setUnsentList(prev => prev.filter(i => i.fileName !== item.fileName));

      // only navigate to results if it's a single sync; otherwise, let the loop continue
      if (!isBulkSync) {
        navigate("/results", { state: { uploadedKey: s3Key, fishData } });
      }

      return true;
    } catch (err) {
      console.error("Sync Error for " + item.fileName, err);
      if (!isBulkSync) alert("Sync failed for " + item.fileName);
      return false;
    } finally {
      setIsSyncing(null);
    }
  };

  const syncAll = async () => {
    if (unsentList.length === 0) return;
    if (!window.confirm(`Sync all ${unsentList.length} items now?`)) return;

    let successCount = 0;
    for (const item of unsentList) {
      const success = await handleSync(item, true);
      if (success) successCount++;
    }

    alert(`Sync Complete! ${successCount} items uploaded successfully.`);
    if (successCount > 0) navigate("/home");
  };

  const clearUnsent = async () => {
    if (window.confirm("Clear your local unsent items? This cannot be undone.")) {
      const { value } = await Preferences.get({ key: 'unsent_catches' });
      const allParsed = value ? JSON.parse(value) : [];
      const remainingItems = allParsed.filter(i => i.userEmail !== currentUser.email);

      await Preferences.set({ key: 'unsent_catches', value: JSON.stringify(remainingItems) });
      setUnsentList([]);
    }
  };

  return (
    <div className="mobile-container">
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="menu-btn" onClick={() => navigate("/gallery-hub")}>＜</button>
      </header>

      <main className="dashboard-content">
        <h1 className="app-title">Unsent Images</h1>

        <section className="capture-selection">
          <p className="welcome-text">Logged in as: {currentUser?.username}</p>

          {unsentList.length > 0 && (
            <div className="button-group" style={{ marginBottom: '20px' }}>
              <button
                className="primary-btn"
                onClick={syncAll}
                disabled={isSyncing !== null}
              >
                {isSyncing ? "Syncing..." : "Sync All Items"}
              </button>

              <button
                className="secondary-btn"
                onClick={clearUnsent}
                style={{ background: '#d9534f' }}
              >
                Clear Cache
              </button>
            </div>
          )}

          <div className="photo-list">
            {isLoading ? (
              <div className="spinner"></div>
            ) : unsentList.length > 0 ? (
              unsentList.map((item) => (
                <div key={item.fileName} className="photo-item">
                  <img src={item.displayImage} alt="Local" className="photo-image" />

                  <div className="photo-info">
                    <p style={{ fontSize: '0.9rem', color: 'white', marginBottom: '10px' }}>
                      <strong>Saved:</strong> {new Date(item.timestamp).toLocaleDateString()}
                    </p>

                    <button
                      className="sync-btn"
                      onClick={() => handleSync(item)}
                      disabled={isSyncing !== null}
                    >
                      {isSyncing === item.fileName ? "..." : "Sync Now"}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="welcome-text">No unsent items for this account.</p>
            )}
          </div>
        </section>
      </main>

      <footer className="dashboard-footer">
        <button className="logout-btn" onClick={() => navigate("/home")}>
          <span className="back-arrow"></span>
        </button>
      </footer>
    </div>
  );
}

export default UnsentGallery;
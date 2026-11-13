import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import logo from './assets/fakelogo.png';
import './App.css';

// fetches and displays a list of identified species from dynamodb and s3
function HistoryPage() {
  const navigate = useNavigate();
  // state hooks for data, loading status, sorting, and user permissions
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('newest');
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewAll, setViewAll] = useState(false);

  // primary function to retrieve data from aws services
  const fetchHistory = async () => {
    setIsLoading(true);
    
    // verify user authentication status via local storage
    const userData = JSON.parse(localStorage.getItem("user"));
    if (!userData || !userData.email) {
      navigate('/login');
      return;
    }

    // set administrative access based on user profile type
    setIsAdmin(userData.userType === "admin");

    const credentials = {
      accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
      secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    };

    const config = { 
      region: import.meta.env.VITE_AWS_REGION, 
      credentials 
    };

    // initialize aws service clients
    const dbClient = new DynamoDBClient(config);
    const docClient = DynamoDBDocumentClient.from(dbClient);
    const s3Client = new S3Client(config);

    try {
      // list s3 bucket contents to check for the existence of thumbnail images
      const s3Response = await s3Client.send(new ListObjectsV2Command({ 
        Bucket: "blueshuttlebucket" 
      }));
      const s3Keys = s3Response.Contents ? s3Response.Contents.map(obj => obj.Key) : [];

      // define dynamodb query parameters, filtering by email unless admin view is toggled
      const scanParams = { TableName: "blueshuttle" };
      if (userData.userType !== "admin" || !viewAll) {
        scanParams.FilterExpression = "userEmail = :email";
        scanParams.ExpressionAttributeValues = { ":email": userData.email };
      }

      // execute dynamodb scan
      const data = await docClient.send(new ScanCommand(scanParams));
      let items = data.Items || [];

      // process each item to generate temporary secure urls for image display
      const itemsWithSignedUrls = await Promise.all(items.map(async (item) => {
        const fullKey = item['blueshuttle-partition'];
        const parts = fullKey.split('/');
        const thumbKey = `${parts[0]}/thumb-${parts[1]}`;
        // prioritize loading lower-resolution thumbnails if they exist in s3
        const keyToSign = s3Keys.includes(thumbKey) ? thumbKey : fullKey;

        const command = new GetObjectCommand({
          Bucket: "blueshuttlebucket",
          Key: keyToSign,
        });

        // generate a signed url that expires after one hour
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return { ...item, displayUrl: signedUrl };
      }));

      // apply chosen sort order to the processed history items
      itemsWithSignedUrls.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      });

      setHistory(itemsWithSignedUrls);
    } catch (err) { 
      console.error("Fetch Error:", err); 
    } finally { 
      setIsLoading(false); 
    }
  };

  // trigger data fetch whenever the sort order or view toggle changes
  useEffect(() => { 
    fetchHistory(); 
  }, [sortOrder, viewAll]);

  return (
    <div className="mobile-container">
      {/* header section for branding and back navigation */}
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="menu-btn" onClick={() => navigate("/gallery-hub")}>＜</button>
      </header>

      <main className="dashboard-content">
        <h1 className="app-title">{viewAll ? "Global History" : "Images History"}</h1>
        
        {/* toggle controls visible only to administrative users */}
        {isAdmin && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <button 
              className="admin"
              style={{ 
                backgroundColor: !viewAll ? 'var(--primary-teal)' : '#555',
                padding: '10px 20px',
                borderRadius: '25px' 
              }}
              onClick={() => setViewAll(false)}
            >
              My History
            </button>
            <button 
              className="admin"
              style={{ 
                backgroundColor: viewAll ? 'var(--primary-teal)' : '#555',
                padding: '10px 20px',
                borderRadius: '25px'
              }}
              onClick={() => setViewAll(true)}
            >
              All History
            </button>
          </div>
        )}

        {/* dropdown for selecting chronologic sort order */}
        <div className="button-group" style={{ marginBottom: '20px' }}>
             <p className="welcome-text" style={{ marginBottom: '5px' }}>Sort Results:</p>
             <select 
               className="action-btn" 
               style={{ padding: '10px', cursor: 'pointer' }}
               onChange={(e) => setSortOrder(e.target.value)}
               value={sortOrder}
             >
               <option value="newest">Newest First</option>
               <option value="oldest">Oldest First</option>
             </select>
        </div>

        {/* vertical list of identified entries with images and metadata */}
        <div className="photo-list">
          {isLoading ? (
            <div className="spinner" style={{ margin: '20px auto' }}></div>
          ) : history.length > 0 ? (
            history.map((item) => (
              <div key={item['blueshuttle-partition']} className="photo-item">
                <img 
                  src={item.displayUrl} 
                  className="photo-image"
                  alt="Catch"
                />
                <div className="photo-info">
                  <h3 style={{ color: 'white', margin: '0 0 5px 0' }}>
                    {item.speciesName || "Unidentified"}
                  </h3>
                  <p><strong>Date:</strong> {new Date(item.timestamp).toLocaleDateString()}</p>
                  <p><strong>GPS:</strong> {item.latitude?.toFixed(4) || "N/A"}, {item.longitude?.toFixed(4) || "N/A"}</p>
                  {/* show additional user context if in admin global view */}
                  {viewAll && <p><strong>User:</strong> {item.userEmail}</p>}
                </div>
              </div>
            ))
          ) : (
            <p className="welcome-text">No records found.</p>
          )}
        </div>
      </main>

      {/* footer providing an additional navigation path back to the hub */}
      <footer className="dashboard-footer">
        <button className="logout-btn" onClick={() => navigate("/gallery-hub")}>
          <span className="back-arrow"></span>
        </button>
      </footer>
    </div>
  );
}

export default HistoryPage;
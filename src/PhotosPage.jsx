import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import logo from './assets/fakelogo.png';
import './App.css';

import { S3Client, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

// manages the photo gallery, allowing users to view, edit, and delete their catch records
function PhotosPage() {
  const navigate = useNavigate();
  // state for photo data, ui loading, and inline editing
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState("");
  const [statusMessage, setStatusMessage] = useState(""); 
  
  // permissions and view toggle state
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [sortOrder, setSortOrder] = useState('newest');

  // aws service configuration
  const credentials = {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  };
  const region = import.meta.env.VITE_AWS_REGION;

  const s3Client = new S3Client({ region, credentials });
  const dbClient = new DynamoDBClient({ region, credentials });
  const docClient = DynamoDBDocumentClient.from(dbClient);

  // helper to display temporary toast-style notifications
  const showFeedback = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(""), 3500);
  };

  // primary data fetcher: combines dynamodb metadata with s3 signed urls
  const fetchUserGallery = async () => {
    setIsLoading(true);
    const userData = JSON.parse(localStorage.getItem("user"));
    
    if (!userData || !userData.email) {
      navigate('/login');
      return;
    }

    setIsAdmin(userData.userType === "admin");

    try {
      // fetch s3 object list to check for pre-generated thumbnails
      const s3Command = new ListObjectsV2Command({
        Bucket: "blueshuttlebucket",
        Prefix: viewAll ? "" : `${userData.email}/`,
      });

      const s3Response = await s3Client.send(s3Command);
      const s3Keys = s3Response.Contents ? s3Response.Contents.map(obj => obj.Key) : [];

      // fetch metadata from dynamodb with filtering based on user role
      const scanParams = { TableName: "blueshuttle" };

      if (userData.userType !== "admin" || !viewAll) {
        scanParams.FilterExpression = "userEmail = :email";
        scanParams.ExpressionAttributeValues = { ":email": userData.email };
      }

      const dbData = await docClient.send(new ScanCommand(scanParams));
      const rawItems = dbData.Items || [];

      // attach temporary signed urls to each item for secure client-side rendering
      const signedItems = await Promise.all(rawItems.map(async (photo) => {
        const originalKey = photo["blueshuttle-partition"];
        const parts = originalKey.split("/");
        const fileName = parts.pop();
        const folder = parts.join("/");

        // display thumbnail if it exists, otherwise fall back to the original image
        const thumbKey = `${folder}/thumb-${fileName}`;
        const keyToSign = s3Keys.includes(thumbKey) ? thumbKey : originalKey;

        const signCommand = new GetObjectCommand({
          Bucket: "blueshuttlebucket",
          Key: keyToSign,
        });
        
        const signedUrl = await getSignedUrl(s3Client, signCommand, { expiresIn: 3600 });
        return { ...photo, displayUrl: signedUrl };
      }));

      // apply chronological sorting
      signedItems.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      });

      setPhotos(signedItems);

    } catch (err) {
      console.error("fetch error:", err);
      showFeedback("failed to load images.");
    } finally {
      setIsLoading(false);
    }
  };

  // re-run fetch whenever the view scope or sort order changes
  useEffect(() => {
    fetchUserGallery();
  }, [viewAll, sortOrder]);

  // update the species name in dynamodb for a specific record
  const handleUpdate = async (partitionKey) => {
    try {
      await docClient.send(new UpdateCommand({
        TableName: "blueshuttle",
        Key: { "blueshuttle-partition": partitionKey },
        UpdateExpression: "set speciesName = :n",
        ExpressionAttributeValues: { ":n": newName }
      }));
      
      // update local state to reflect change immediately without a full refresh
      setPhotos(prev => prev.map(p => 
        p["blueshuttle-partition"] === partitionKey ? { ...p, speciesName: newName } : p
      ));
      setEditingId(null);
      showFeedback("update saved!");
    } catch {
      showFeedback("update failed.");
    }
  };

  // remove both the s3 image file and the dynamodb record
  const deletePhoto = async (partitionKey) => {
    if (!window.confirm("delete this catch permanently?")) return;
    
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: "blueshuttlebucket",
        Key: partitionKey,
      }));

      await docClient.send(new DeleteCommand({
        TableName: "blueshuttle",
        Key: { "blueshuttle-partition": partitionKey }
      }));

      setPhotos(prev => prev.filter(p => p["blueshuttle-partition"] !== partitionKey));
      showFeedback("record deleted.");
    } catch {
      showFeedback("delete failed.");
    }
  };

  return (
    <div className="mobile-container">
      {/* app header with branding and navigation */}
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="menu-btn" onClick={() => navigate("/gallery-hub")}>＜</button>
      </header>

      <main className="dashboard-content">
        <h1 className="app-title">{viewAll ? "Global Gallery" : "My Images"}</h1>
        
        {/* user feedback banner */}
        {statusMessage && (
          <div className="status-banner">
            {statusMessage}
          </div>
        )}

        {/* admin controls for toggling between personal and global data */}
        {isAdmin && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <button 
              className="admin-toggle"
              style={{ backgroundColor: !viewAll ? 'var(--primary-teal)' : '#333' }}
              onClick={() => setViewAll(false)}
            >
              My Images
            </button>
            <button 
              className="admin-toggle"
              style={{ backgroundColor: viewAll ? 'var(--primary-teal)' : '#333' }}
              onClick={() => setViewAll(true)}
            >
              All Images
            </button>
          </div>
        )}

        {/* gallery filtering and sorting controls */}
        {isAdmin && viewAll && (
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
        )}

        {/* photo grid/list container */}
        <div className="photo-list">
          {isLoading ? (
            <div className="spinner"></div>
          ) : photos.length > 0 ? (
            photos.map((photo) => (
              <div key={photo["blueshuttle-partition"]} className="photo-item">
                <img 
                  src={photo.displayUrl} 
                  alt="Fish" 
                  className="photo-image"
                  onError={(e) => { e.target.src = "/placeholder.png"; }}
                />
                
                <div className="photo-info">
                  {/* conditional rendering for edit vs view mode */}
                  {editingId === photo["blueshuttle-partition"] ? (
                    <div className="edit-mode">
                      <input 
                        className="custom-input"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        autoFocus
                      />
                      <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                        <button className="sync-btn" onClick={() => handleUpdate(photo["blueshuttle-partition"])}>Save</button>
                        <button className="sync-btn cancel" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 style={{color: 'white', margin: '0 0 5px 0'}}>{photo.speciesName}</h3>
                      <p style={{fontSize: '0.85rem', opacity: 0.7, margin: '0'}}>
                        {viewAll && <span style={{color: 'var(--primary-teal)'}}>{photo.userEmail} | </span>}
                        {new Date(photo.timestamp).toLocaleString([], { 
                          dateStyle: 'short', 
                          timeStyle: 'short' 
                        })}
                      </p>
                      
                      <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
                        <button 
                          className="sync-btn" 
                          onClick={() => {
                            setEditingId(photo["blueshuttle-partition"]);
                            setNewName(photo.speciesName);
                          }}
                        >
                          Modify
                        </button>
                        <button 
                          className="sync-btn delete" 
                          onClick={() => deletePhoto(photo["blueshuttle-partition"])}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{textAlign: 'center', marginTop: '50px'}}>
              <p className="welcome-text">No images found.</p>
              <button className="main-action-btn" onClick={() => navigate("/identify")}>Start Fishing</button>
            </div>
          )}
        </div>
      </main>

      <footer className="dashboard-footer">
        <button className="logout-btn" onClick={() => navigate("/gallery-hub")}>
          <span className="back-arrow"></span>
        </button>
      </footer>
    </div>
  );
}

export default PhotosPage;
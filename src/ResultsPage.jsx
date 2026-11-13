import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import logo from './assets/fakelogo.png';
import './App.css';

// displays the ai analysis results and allows users to confirm or correct the identification
function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // retrieve navigation state passed from the identification page
  const fishData = location.state?.fishData || null;
  const uploadedKey = location.state?.uploadedKey || null;

  // state management for ui flow, editing, and database operations
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [manualName, setManualName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // helper for displaying temporary notifications
  const showFeedback = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(""), 3500);
  };

  // parse the top prediction from the nested api response
  const topSpecies = fishData?.results?.[0]?.species?.[0] || null;
  const identifiedName = topSpecies?.name || "Unknown Species";
  const confidenceValue = topSpecies?.accuracy 
    ? (topSpecies.accuracy * 100).toFixed(1) + "%" 
    : "0%";

  // ensure required data exists; otherwise redirect back to the start
  useEffect(() => {
    if (!fishData) {
      navigate("/identify");
      return;
    }
    // brief synthetic delay to allow for visual transitions
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [fishData, navigate]);

  // persists the confirmed or corrected species name to the database
  const finalizeResult = async (finalName) => {
    setIsSaving(true);

    const client = new DynamoDBClient({
      region: import.meta.env.VITE_AWS_REGION,
      credentials: {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
      },
    });

    const docClient = DynamoDBDocumentClient.from(client);

    try {
      // update the record with the final species name and mark as confirmed
      await docClient.send(new UpdateCommand({
        TableName: "blueshuttle",
        Key: { "blueshuttle-partition": uploadedKey },
        UpdateExpression: "set speciesName = :s, confirmed = :c",
        ExpressionAttributeValues: {
          ":s": finalName,
          ":c": true
        }
      }));

      showFeedback("result saved to your gallery!");
      setTimeout(() => navigate("/home"), 1200);

    } catch (err) {
      console.error("update error", err);
      showFeedback("failed to save. returning home...");
      setTimeout(() => navigate("/home"), 1500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mobile-container">
      {/* header with branding and quick home navigation */}
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="menu-btn" onClick={() => navigate("/home")}>＜</button>
      </header>

      <main className="dashboard-content">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <h2 className="app-title">Analyzing...</h2>
          </div>
        ) : (
          <>
            <div className="success-icon-container">
              <span className="success-check">🔍</span>
            </div>
            <h1 className="app-title">AI Prediction</h1>

            {statusMessage && (
              <div className="status-banner">
                {statusMessage}
              </div>
            )}

            {/* card container for the prediction and control buttons */}
            <section className="results-card">
              {!isEditing ? (
                <>
                  <div className="result-item">
                    <span className="result-label">AI Thinks This Is:</span>
                    <span className="result-value" style={{color: '#4ecdc4'}}>
                      {identifiedName}
                    </span>
                  </div>
                  
                  <div className="result-item">
                    <span className="result-label">Confidence:</span>
                    <span className="result-value">{confidenceValue}</span>
                  </div>

                  <div className="button-group" style={{marginTop: '20px'}}>
                    <button className="primary-btn" onClick={() => finalizeResult(identifiedName)} disabled={isSaving}>
                      Confirm Result
                    </button>
                    <button className="secondary-btn" style={{backgroundColor: '#666'}} onClick={() => setIsEditing(true)}>
                      Modify
                    </button>
                    <button className="secondary-btn" onClick={() => finalizeResult("Unknown/Unidentified")}>
                      I Don't Know
                    </button>
                  </div>
                </>
              ) : (
                /* manual entry form if the user needs to correct the ai */
                <div className="auth-form-container" style={{padding: '0', border: 'none', background: 'none'}}>
                  <span className="result-label">Enter Correct Name:</span>
                  <input 
                    className="custom-input" 
                    placeholder="Fish Name..." 
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                  />
                  <div className="preview-controls">
                    <button className="primary-btn" onClick={() => finalizeResult(manualName)} disabled={!manualName || isSaving}>
                      Save Correction
                    </button>
                    <button className="secondary-btn" onClick={() => setIsEditing(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
      
      {/* navigation footer for returning to the previous screen */}
      <footer className="dashboard-footer">
        <button className="logout-btn">
          <span className="back-arrow"></span>
        </button>
      </footer>
    </div>
  );
}

export default ResultsPage;
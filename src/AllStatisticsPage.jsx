import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import logo from './assets/fakelogo.png';
import './App.css';

function AllStatisticsPage() {
  // hook to handle navigation between routes
  const navigate = useNavigate();

  // state to manage the count of total, identified, and unidentified fish
  const [stats, setStats] = useState({ total: 0, resultReceived: 0, noResult: 0 });

  useEffect(() => {
    // asynchronous function to fetch data from aws dynamodb
    const loadStatistics = async () => {
      try {
        // pull credentials from environment variables for secure access
        const credentials = {
          accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
          secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
        };
        const region = import.meta.env.VITE_AWS_REGION;

        // initialize the dynamodb client with the specified region and credentials
        const client = new DynamoDBClient({ region, credentials });
        
        // wrap the client to simplify working with plain javascript objects
        const docClient = DynamoDBDocumentClient.from(client);

        // execute a scan command to retrieve all entries from the blueshuttle table
        const data = await docClient.send(new ScanCommand({ TableName: 'blueshuttle' }));
        const items = data.Items || [];

        // calculate total submissions
        const total = items.length;

        // filter results to find items that have a valid species name
        // excluded common strings used when the ai fails to identify a fish
        const resultReceived = items.filter((item) => {
          const name = item.speciesName || '';
          return name && !['Unidentified Fish', 'Unknown/Unidentified'].includes(name);
        }).length;

        // calculate the number of failed or unknown results
        const noResult = total - resultReceived;

        // update the state to trigger a re-render with the new data
        setStats({ total, resultReceived, noResult });
      } catch (err) {
        // log any errors related to network connectivity or aws permissions
        console.error('statistics load error:', err);
      }
    };

    loadStatistics();
  }, []);

  return (
    <div className="mobile-container">
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        {/* navigation button to return to the home dashboard */}
        <button className="menu-btn" onClick={() => navigate('/home')}>
          ＜
        </button>
      </header>

      <main className="dashboard-content">
        <h1 className="app-title">All Statistics</h1>
        <p className="welcome-text">Totals across all submitted photos and identification results.</p>

        {/* display grid for statistical cards */}
        <div className="stats-grid">
          {/* card for total submissions */}
          <div className="stat-card scanned-card">
            <span className="stat-label">Photos Sent</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          
          {/* card for successful ai identifications */}
          <div className="stat-card confirmed-card">
            <span className="stat-label">Result Received</span>
            <span className="stat-value">{stats.resultReceived}</span>
          </div>
          
          {/* card for submissions with low confidence or unknown species */}
          <div className="stat-card unsure-card">
            <span className="stat-label">No Result</span>
            <span className="stat-value">{stats.noResult}</span>
          </div>
        </div>
      </main>

      <footer className="dashboard-footer">
        <button className="logout-btn">
          <span className="back-arrow"></span>
        </button>
      </footer>
    </div>
  );
}

export default AllStatisticsPage;
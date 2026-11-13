import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import logo from './assets/fakelogo.png';
import './App.css';

// aggregates and displays personal submission metrics for the logged-in user
function MyStatisticsPage() {
  const navigate = useNavigate();
  // state to store the calculated tallies for the user dashboard
  const [stats, setStats] = useState({ total: 0, resultReceived: 0, noResult: 0 });

  useEffect(() => {
    // retrieves records from the database and filters them based on the active user session
    const loadUserStatistics = async () => {
      const userData = JSON.parse(localStorage.getItem('user'));
      
      // redirect if session data is missing
      if (!userData?.email) {
        navigate('/login');
        return;
      }

      try {
        const credentials = {
          accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
          secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
        };
        const region = import.meta.env.VITE_AWS_REGION;

        const client = new DynamoDBClient({ region, credentials });
        const docClient = DynamoDBDocumentClient.from(client);

        // scan the table and filter results by user email manually
        const data = await docClient.send(new ScanCommand({ TableName: 'blueshuttle' }));
        const items = (data.Items || []).filter((item) => item.userEmail === userData.email);

        const total = items.length;
        
        // determine "result received" count by filtering out placeholder names
        const resultReceived = items.filter((item) => {
          const name = item.speciesName || '';
          return name && !['Unidentified Fish', 'Unknown/Unidentified'].includes(name);
        }).length;

        // calculate remaining items that have no definitive name assigned
        const noResult = total - resultReceived;

        setStats({ total, resultReceived, noResult });
      } catch (err) {
        console.error('user statistics load error:', err);
      }
    };

    loadUserStatistics();
  }, [navigate]);

  return (
    <div className="mobile-container">
      {/* navigation header with app branding */}
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="menu-btn" onClick={() => navigate('/home')}>
          ＜
        </button>
      </header>

      <main className="dashboard-content">
        <h1 className="app-title">My Statistics</h1>
        <p className="welcome-text">Totals for your submitted photos and identification results.</p>

        {/* grid display for various metric categories */}
        <div className="stats-grid">
          <div className="stat-card scanned-card">
            <span className="stat-label">Photos Sent</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-card confirmed-card">
            <span className="stat-label">Result Received</span>
            <span className="stat-value">{stats.resultReceived}</span>
          </div>
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

export default MyStatisticsPage;
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import logo from './assets/fakelogo.png';
import './App.css';

// provides the main dashboard for the application including navigation and offline data syncing alerts
function HomePage() {
  const navigate = useNavigate();
  // state hooks for managing the sync notification visibility and user profile data
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [userName, setUserName] = useState("User");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // retrieve user session data from local storage on component mount
    const userData = JSON.parse(localStorage.getItem("user"));
    if (userData) {
      if (userData.username) {
        setUserName(userData.username);
      }
      // determine if the logged in user has administrative privileges for restricted routes
      setIsAdmin(userData.userType === "admin");
    }

    // initial check to see if there are images waiting to be synced while online
    checkSyncStatus();

    // set up a listener to monitor network changes and trigger sync checks when reconnected
    const networkListener = Network.addListener('networkStatusChange', status => {
      if (status.connected) {
        checkSyncStatus();
      } else {
        // hide the sync banner immediately if the connection is lost
        setShowSyncBanner(false);
      }
    });

    // cleanup function to remove the network event listener when the component unmounts
    return () => {
      networkListener.then(l => l.remove());
    };
  }, []);

  // logic to determine if the user has pending local data that needs to be uploaded
  const checkSyncStatus = async () => {
    const status = await Network.getStatus();
    const { value } = await Preferences.get({ key: 'unsent_catches' });
    
    // only show the banner if the device is online and unsent data exists in preferences
    if (status.connected && value) {
      const catches = JSON.parse(value);
      const userData = JSON.parse(localStorage.getItem("user"));
      // filter the global unsent catches to only identify items belonging to the current user
      const userCatches = catches.filter(item => item.userEmail === userData?.email);
      
      if (userCatches.length > 0) {
        setShowSyncBanner(true);
      }
    } else {
      setShowSyncBanner(false);
    }
  };

  // securely remove user session data and return to the login screen
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  return (
    <div className="mobile-container">
      {/* header section containing brand logo and primary logout action */}
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <span className="back-arrow"></span>Log Out
        </button>
      </header>

      {/* interactive banner that appears when local data is ready to be uploaded to s3 */}
      {showSyncBanner && (
        <div className="sync-notification-banner" onClick={() => navigate('/gallery/unsent')}>
          <span className="sync-icon">🔄</span>
          <p>Reconnected: Click to sync your images!</p>
        </div>
      )}

      {/* main navigation grid for core app features */}
      <main className="dashboard-content">
        <h1 className="app-title">Fish Identifier App</h1>
        <p className="welcome-text">Welcome back, {userName}!</p>

        <div className="button-group">
          {/* route to the camera and fish identification processing page */}
          <button className="main-action-btn" onClick={() => navigate("/identify")}>
            <span className="btn-icon">📷</span>
            <span className="btn-text">Identify Fish</span>
          </button>

          {/* route to the gallery hub for viewing sent and unsent images */}
          <button className="main-action-btn" onClick={() => navigate("/gallery-hub")}>
            <span className="btn-icon">📁</span>
            <span className="btn-text">My Gallery</span>
          </button>

          {/* route to personal statistics and catch data visualization */}
          <button className="main-action-btn" onClick={() => navigate("/mystatistics")}>
            <span className="btn-icon">📊</span>
            <span className="btn-text">My Statistics</span>
          </button>

          {/* administrative-only route for viewing aggregated global statistics */}
          {isAdmin && (
            <button className="main-action-btn" onClick={() => navigate("/all-statistics")}>
              <span className="btn-icon">🌐</span>
              <span className="btn-text">All Statistics</span>
            </button>
          )}

          {/* route to the map view for geographical fish catch data */}
          <button className="main-action-btn" onClick={() => navigate("/map")}>
            <span className="btn-icon">🗺️</span>
            <span className="btn-text">Map</span>
          </button>
        </div>
      </main>

      {/* footer section providing visual balance and a secondary logout trigger */}
      <footer className="dashboard-footer">
        <button className="logout-btn" onClick={handleLogout}>
          <span className="back-arrow"></span>
        </button>
      </footer>
    </div>
  );
}

export default HomePage;
import { useNavigate } from 'react-router-dom';
import logo from './assets/fakelogo.png';

// provides a central navigation hub for viewing different categories of stored images
function GalleryHub() {
  // hook to enable programmatic navigation between routes
  const navigate = useNavigate();

  return (
    <div className="mobile-container">
      {/* header section containing the brand logo and a back button to the home screen */}
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="menu-btn" onClick={() => navigate("/home")}>＜</button>
      </header>

      {/* main content area displaying navigation options organized by category */}
      <main className="dashboard-content">
        <h1 className="app-title">Gallery</h1>
        
        <div className="button-group">
          {/* section for image viewing based on sync status with the cloud */}
          <p className="welcome-text">My Images</p>
          
          {/* navigate to view images already successfully uploaded to s3 and logged */}
          <button className="main-action-btn" onClick={() => navigate("/gallery/sent")}>
            <span className="btn-icon">☁️</span> Processed Images
          </button>
          
          {/* navigate to view images stored locally that are waiting for an internet connection to sync */}
          <button className="main-action-btn" onClick={() => navigate("/gallery/unsent")}>
            <span className="btn-icon">📱</span> Unprocessed Images
          </button>

          {/* section for viewing data logs and historical species identification records */}
          <p className="welcome-text" style={{marginTop: '20px'}}>My History</p>
          
          {/* navigate to the detailed history page containing dynamodb records */}
          <button className="main-action-btn" onClick={() => navigate("/history")}>
            <span className="btn-icon">📊</span> My History
          </button>
        </div>
      </main>

      {/* footer area providing visual consistency across the dashboard screens */}
      <footer className="dashboard-footer">
        <button className="logout-btn">
          <span className="back-arrow"></span>
        </button>
      </footer>
    </div>
  );
}

export default GalleryHub;
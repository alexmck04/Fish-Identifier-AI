// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./HomePage"; 
import IdentifyPage from "./IdentifyPage";
import PhotosPage from "./PhotosPage";
import GalleryHub from "./GalleryHub";
import UnsentGallery from "./UnsentGallery";
import HistoryPage from "./HistoryPage";
import ResultsPage from "./ResultsPage";
import MyStatisticsPage from "./StatisticsPage";
import AllStatisticsPage from "./AllStatisticsPage";
import MapPage from "./MapPage";

// New Auth Components
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import ForgotPasswordPage from "./ForgotPasswordPage";

/**
 * helper component to protect private routes.
 * if no user is found in localStorage, it redirects to login.
 */
const ProtectedRoute = ({ children }) => {
  const savedUser = localStorage.getItem("user");
  
  if (!savedUser) {
    // replace prop ensures the user can't use the back button to return to a protected page
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

/**
 * helper component for auth pages (login/register).
 * if a user is already logged in, it skips the login screen and goes home.
 */
const PublicRoute = ({ children }) => {
  const savedUser = localStorage.getItem("user");
  
  if (savedUser) {
    return <Navigate to="/home" replace />;
  }
  
  return children;
};

function App() {
  return (
    <>
      <Routes>
        {/* root handling: if logged in go home, else go login */}
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* auth system (publicly accessible unless already logged in) */}
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* protected app pages: user stays signed in here until they logout */}
        <Route path="/home" element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        } />
        
        <Route path="/identify" element={
          <ProtectedRoute>
            <IdentifyPage/>
          </ProtectedRoute>
        } />

        <Route path="/results" element={
          <ProtectedRoute>
            <ResultsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/gallery-hub" element={
          <ProtectedRoute>
            <GalleryHub />
          </ProtectedRoute>
        } />
        
        <Route path="/gallery/sent" element={
          <ProtectedRoute>
            <PhotosPage />
          </ProtectedRoute>
        } />
        
        <Route path="/gallery/unsent" element={
          <ProtectedRoute>
            <UnsentGallery />
          </ProtectedRoute>
        } />

        <Route path="/history" element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        } />
        
        <Route path="/mystatistics" element={
          <ProtectedRoute>
            <MyStatisticsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/all-statistics" element={
          <ProtectedRoute>
            <AllStatisticsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/map" element={
          <ProtectedRoute>
            <MapPage />
          </ProtectedRoute>
        } />

        {/* catch-all: redirect any unknown paths to home */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </>
  );
}

export default App;
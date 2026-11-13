import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from 'bcryptjs';
import logo from './assets/fakelogo.png';
import './App.css';

// handles user authentication by verifying credentials against dynamodb
function LoginPage() {
  // state hooks for user input and button loading status
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const navigate = useNavigate();

  // processes the login form submission
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);

    // configure the aws sdk client using environment variables for security
    const client = new DynamoDBClient({
      region: import.meta.env.VITE_AWS_REGION,
      credentials: {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
      },
    });
    const docClient = DynamoDBDocumentClient.from(client);

    try {
      // fetch a single user record from dynamodb using the lowercase email as the key
      const res = await docClient.send(new GetCommand({
        TableName: "blueshuttleusers",
        Key: { "blueshuttleusers-parition": email.toLowerCase() }
      }));

      const user = res.Item;

      // check if the user exists in the database
      if (!user) {
        alert("User not found.");
        setIsLoggingIn(false);
        return;
      }

      // use bcrypt to securely compare the plain text input with the stored hash
      const isPasswordCorrect = bcrypt.compareSync(password, user.password);

      if (isPasswordCorrect) {
        // persists basic user session data to local storage for use across the app
        localStorage.setItem("user", JSON.stringify({
          email: user["blueshuttleusers-parition"],
          username: user.username,
          userType: user.userType
        }));
        
        // redirect to the dashboard upon successful authentication
        navigate('/home');
      } else {
        alert("Incorrect password.");
      }
    } catch (err) {
      console.error("Login Error:", err);
      alert("Error connecting to database. Check your connection or AWS credentials.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="mobile-container">
      {/* header section containing the application logo */}
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="menu-btn" onClick={() => navigate('/login')}>☰</button>
      </header>

      {/* main content area for the login form and navigation links */}
      <main className="dashboard-content">
        <h1 className="app-title">Login</h1>
        <p className="welcome-text">Welcome back! Please sign in.</p>
        
        <form onSubmit={handleLogin} className="auth-form-container">
          {/* email input field with lowercase processing handled in the logic */}
          <input 
            className="custom-input" 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
          {/* password input field using type password to obscure characters */}
          <input 
            className="custom-input" 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
          
          {/* primary action button with loading state feedback */}
          <button type="submit" className="main-action-btn" disabled={isLoggingIn} style={{marginTop: '20px'}}>
            <span className="btn-text">{isLoggingIn ? "Logging in..." : "Login"}</span>
          </button>
        </form>

        {/* secondary navigation links for recovery and account creation */}
        <div className="auth-footer-links" style={{ textAlign: 'center', marginTop: '15px' }}>
          <p onClick={() => navigate('/forgot-password')} style={{ cursor: 'pointer', color: 'var(--primary-teal)', marginBottom: '10px' }}>
            Forgot Password?
          </p>
          <p onClick={() => navigate('/register')} style={{ cursor: 'pointer' }}>
            Need an account? <strong>Register</strong>
          </p>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
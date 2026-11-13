import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from 'bcryptjs';
import logo from './assets/fakelogo.png';
import './App.css';

// manage user password recovery via a two-step verification and update process
function ForgotPasswordPage() {
  // state hooks for user input, current step, and async status
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // initialize dynamodb client with credentials from environment variables
  const client = new DynamoDBClient({
    region: import.meta.env.VITE_AWS_REGION,
    credentials: {
      accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
      secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    },
  });
  const docClient = DynamoDBDocumentClient.from(client);

  // handle the first step by checking if the email exists in the users table
  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // attempt to fetch user record using lowercase email as the partition key
      const res = await docClient.send(new GetCommand({
        TableName: "blueshuttleusers",
        Key: { "blueshuttleusers-parition": email.toLowerCase() }
      }));
      
      // if account exists, move to step two for password reset
      if (res.Item) {
        setNewPassword(''); 
        setStep(2);
      } else {
        alert("Account not found.");
      }
    } catch (err) { 
      console.error(err);
      alert("Error connecting to database."); 
    } finally { 
      setLoading(false); 
    }
  };

  // handle the second step by hashing the new password and updating the record
  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // secure new password using salt and bcrypt hashing before database storage
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);

      // update the existing user item with the new hashed password
      await docClient.send(new UpdateCommand({
        TableName: "blueshuttleusers",
        Key: { "blueshuttleusers-parition": email.toLowerCase() },
        UpdateExpression: "set password = :p",
        ExpressionAttributeValues: { ":p": hashedPassword }
      }));
      
      alert("Password Updated!");
      navigate('/login');
    } catch (err) { 
      console.error(err);
      alert("Failed to reset."); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="mobile-container">
      {/* header section containing app logo and back navigation */}
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="menu-btn" onClick={() => navigate('/login')}>＜</button>
      </header>

      {/* main content area that toggles between verification and reset forms */}
      <main className="dashboard-content">
        <h1 className="app-title">Reset Password</h1>
        
        {/* step 1: verification form to collect email address */}
        {step === 1 ? (
          <form onSubmit={handleVerify} className="auth-form-container">
            <p className="welcome-text">Enter your email to reset.</p>
            <input 
              className="custom-input" 
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
            <button type="submit" className="main-action-btn" disabled={loading} style={{marginTop: '20px'}}>
              <span className="btn-text">{loading ? "Verifying..." : "Next"}</span>
            </button>
          </form>
        ) : (
          /* step 2: reset form to collect and update new password */
          <form onSubmit={handleReset} className="auth-form-container">
            <p className="welcome-text">Set new password for <strong>{email}</strong></p>
            <input 
              className="custom-input" 
              type="password" 
              placeholder="New Password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} 
              autoComplete="new-password"
              required 
            />
            <button type="submit" className="main-action-btn" disabled={loading} style={{marginTop: '20px'}}>
              <span className="btn-text">{loading ? "Updating..." : "Update Password"}</span>
            </button>
          </form>
        )}

        {/* tertiary navigation link to return to the login screen */}
        <p className="auth-link-text" onClick={() => navigate('/login')} style={{marginTop: '20px'}}>
          Return to <strong>Login</strong>
        </p>
      </main>
    </div>
  );
}

export default ForgotPasswordPage;
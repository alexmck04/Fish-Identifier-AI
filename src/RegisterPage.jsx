import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from 'bcryptjs';
import logo from './assets/fakelogo.png';
import './App.css';

// handles new user creation by hashing passwords and storing profiles in dynamodb
function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsRegistering(true);

    // initialize the dynamodb client with secure environment credentials
    const client = new DynamoDBClient({
      region: import.meta.env.VITE_AWS_REGION,
      credentials: {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
      },
    });
    const docClient = DynamoDBDocumentClient.from(client);

    try {
      // check if the email is already registered using the partition key
      const checkUser = await docClient.send(new GetCommand({
        TableName: "blueshuttleusers",
        Key: { "blueshuttleusers-parition": email.toLowerCase() }
      }));

      if (checkUser.Item) {
        alert("email already exists.");
        setIsRegistering(false);
        return;
      }

      // secure the password using salt and hashing before database storage
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(password, salt);

      // create the new user record with default permissions and a timestamp
      await docClient.send(new PutCommand({
        TableName: "blueshuttleusers",
        Item: {
          "blueshuttleusers-parition": email.toLowerCase(),
          username: username,
          password: hashedPassword, 
          userType: "default",
          createdAt: new Date().toISOString()
        }
      }));

      alert("registration successful!");
      navigate('/login');
    } catch (err) {
      console.error(err);
      alert("registration failed: " + err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="mobile-container">
      
      {/* header with logo and navigation back to login */}
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="menu-btn" onClick={() => navigate('/login')}>＜</button>
      </header>

      <main className="dashboard-content">
        <h1 className="app-title">Create Account</h1>
        <p className="welcome-text">Join the Fish AI community</p>
        
        {/* collection of user details for the registration process */}
        <form onSubmit={handleRegister} className="auth-form-container">
          <input 
            className="custom-input" 
            type="text" 
            placeholder="Username" 
            onChange={(e) => setUsername(e.target.value)} 
            required 
          />
          <input 
            className="custom-input" 
            type="email" 
            placeholder="Email" 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
          <input 
            className="custom-input" 
            type="password" 
            placeholder="Password" 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
          
          <button type="submit" className="main-action-btn" disabled={isRegistering} style={{marginTop: '20px'}}>
            <span className="btn-text">{isRegistering ? "Processing..." : "Register"}</span>
          </button>
        </form>

        {/* redirect link for users who already have an account */}
        <p className="auth-link-text" onClick={() => navigate('/login')}>
          Already have an account? <strong>Login</strong>
        </p>
      </main>
    </div>
  );
}

export default RegisterPage;
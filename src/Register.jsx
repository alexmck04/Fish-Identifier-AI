import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const registerUser = async (email, password, username) => {
  const client = new DynamoDBClient({ 
    region: import.meta.env.VITE_AWS_REGION, 
    credentials: {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    }
  });
  const docClient = DynamoDBDocumentClient.from(client);

  try {
    // check if user exists
    const checkRes = await docClient.send(new GetCommand({
      TableName: "blueshuttleusers",
      Key: { email }
    }));

    if (checkRes.Item) {
      alert("User already exists!");
      return;
    }

    //create User
    await docClient.send(new PutCommand({
      TableName: "blueshuttleusers",
      Item: {
        email: email,
        password: password,
        username: username,
        userType: "default",
        createdAt: new Date().toISOString()
      }
    }));

    alert("Registration successful!");
  } catch (err) {
    console.error("Register Error:", err);
  }
};
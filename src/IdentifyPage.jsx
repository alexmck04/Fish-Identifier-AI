import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import ExifReader from 'exifreader';
import logo from './assets/fakelogo.png';
import './App.css';

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

function IdentifyPage() {
  const Navigate = useNavigate();
  const [image, setImage] = useState(null);
  const [fullPhoto, setFullPhoto] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [notification, setNotification] = useState(null);
  const [askGPS, setAskGPS] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    } else {
      Navigate('/login');
    }
  }, [Navigate]);

  const isNative = Capacitor.isNativePlatform();

  // helpers 

  const convertDMSToDD = (dms, ref) => {
    const [degrees, minutes, seconds] = dms;
    let dd = degrees + minutes / 60 + seconds / 3600;
    if (ref === "S" || ref === "W") dd = -dd;
    return dd;
  };


  // read image exif location metadata
  const getImageMetadataLocation = async (arrayBuffer) => {
    try {
      const tags = ExifReader.load(arrayBuffer);
      if (tags.GPSLatitude && tags.GPSLongitude) {
        return {
          latitude: convertDMSToDD(tags.GPSLatitude.value, tags.GPSLatitudeRef.value),
          longitude: convertDMSToDD(tags.GPSLongitude.value, tags.GPSLongitudeRef.value),
        };
      }
    } catch (err) { console.warn("metadata extraction failed:", err); }
    return null;
  };

  // get current location of user
  const getCurrentLocation = async () => {
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch { return null; }
  };

  // offline storage

  const saveToLocalStorage = async (arrayBuffer, fileName, location = null) => {
    try {
      // convert arraybuffer to Base64
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64Data = btoa(binary);

      // save raw file to unsent folder
      await Filesystem.writeFile({
        path: `unsent/${fileName}`,
        data: base64Data,
        directory: Directory.Data,
        recursive: true
      });

      // update preferences ledger
      const { value } = await Preferences.get({ key: 'unsent_catches' });
      const catches = value ? JSON.parse(value) : [];
      catches.push({
        fileName: fileName,
        userEmail: currentUser?.email,
        timestamp: new Date().toISOString(),
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        status: 'offline'
      });

      await Preferences.set({ key: 'unsent_catches', value: JSON.stringify(catches) });
      alert("Saved locally. Will sync when online.");
      Navigate("/home");
    } catch (err) {
      console.error("[Offline Save Error]", err);
      setNotification("Failed to save locally.");
    }
  };

  // photo & upload handlers

  const handlePhoto = async (sourceType) => {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: sourceType,
        saveToGallery: isNative && sourceType === CameraSource.Camera
      });

      setImage(photo.webPath);
      setFullPhoto(photo);
      setNotification(null);
    } catch {}
  };

  const processUpload = async (arrayBuffer, location) => {
    const fileName = `fish-${Date.now()}.jpg`;
    const s3Key = `${currentUser.email}/${fileName}`;

    try {
      const credentials = {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY?.trim(),
      };
      const region = import.meta.env.VITE_AWS_REGION;
      const bucket = import.meta.env.VITE_S3_BUCKET_NAME;

      const s3Client = new S3Client({ region, credentials });
      const dbClient = new DynamoDBClient({ region, credentials });
      const docClient = DynamoDBDocumentClient.from(dbClient);

      // upload raw binary
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: "image/jpeg"
      }));

      // uses lambda API URL to upload and send image to fishial
      const lambdaApiUrl = "https://gc2d5ks32a.execute-api.eu-west-1.amazonaws.com/default";
      const lambdaResponse = await fetch(lambdaApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, key: s3Key })
      });

      const rawResult = await lambdaResponse.json();
      let fishData = rawResult.body ? (typeof rawResult.body === 'string' ? JSON.parse(rawResult.body) : rawResult.body) : rawResult;

      const fishSpecies = fishData.results?.[0]?.species?.[0]?.name || "unidentified fish";

      await docClient.send(new PutCommand({
        TableName: "blueshuttle",
        Item: {
          "blueshuttle-partition": s3Key,
          speciesName: fishSpecies,
          timestamp: new Date().toISOString(),
          latitude: location ? location.latitude : null,
          longitude: location ? location.longitude : null,
          userEmail: currentUser.email,
          username: currentUser.username
        }
      }));

      Navigate("/results", { state: { uploadedKey: s3Key, fishData } });
    } catch (err) {
      console.error("[Upload Error] Saving locally:", err);
      // If the upload fails, save the exact binary buffer locally
      await saveToLocalStorage(arrayBuffer, fileName, location);
    }
  };

  const uploadProcess = async () => {
    if (!fullPhoto || !currentUser) return;
    setIsUploading(true);

    try {
      let arrayBuffer;

      // the browser will not show the camera functionlity, only the gallery
      if (Capacitor.isNativePlatform()) {
        const file = await Filesystem.readFile({ path: fullPhoto.path });
        const byteCharacters = atob(file.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        arrayBuffer = new Uint8Array(byteNumbers).buffer;
      } else {
        const response = await fetch(fullPhoto.webPath);
        const blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
      }

      let location = await getImageMetadataLocation(arrayBuffer);

      if (!location) {
        setNotification("no gps data found in image.");
        setAskGPS(true);
        window.__pendingUpload = { arrayBuffer };
        setIsUploading(false);
        return;
      }

      await processUpload(arrayBuffer, location);
    } catch (err) {
      console.error(err);
      setNotification("upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGPSDecision = async (useGPS) => {
    setAskGPS(false);
    setIsUploading(true);
    const { arrayBuffer } = window.__pendingUpload || {};
    let location = useGPS ? await getCurrentLocation() : null;
    await processUpload(arrayBuffer, location);
    setIsUploading(false);
  };

  return (
    <div className="mobile-container">
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="menu-btn" onClick={() => Navigate("/home")}>＜</button>
      </header>

      <main className="dashboard-content">
        <h1 className="app-title">Identify Fish</h1>

        {notification && <div className="notification-box">{notification}</div>}

        {askGPS && (
          <div className="notification-box">
            <p>Use your current location instead?</p>
            <div className="button-group">
              <button className="primary-btn" onClick={() => handleGPSDecision(true)}>Yes</button>
              <button className="secondary-btn" onClick={() => handleGPSDecision(false)}>No</button>
            </div>
          </div>
        )}

        <div className="photo-preview-box">
          {image ? (
            <div className="preview-container">
              <img src={image} alt="Preview" className="fish-preview" />
              <div className="preview-controls">
                <button className="secondary-btn" onClick={() => setImage(null)} disabled={isUploading}>Retake</button>
                <button className="primary-btn" onClick={uploadProcess} disabled={isUploading}>
                  {isUploading ? "Identifying..." : "Identify Fish"}
                </button>
              </div>
            </div>
          ) : (
            <div className="capture-selection">
              <p className="welcome-text">Logged in as: {currentUser?.username}</p>
              <div className="button-group">
                {isNative && (
                  <button className="main-action-btn" onClick={() => handlePhoto(CameraSource.Camera)}>📷 Camera</button>
                )}
                <button className="main-action-btn" onClick={() => handlePhoto(CameraSource.Photos)}>📁 Gallery</button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="dashboard-footer">
        <button className="logout-btn" onClick={() => Navigate("/home")}></button>
      </footer>
    </div>
  );
}

export default IdentifyPage;
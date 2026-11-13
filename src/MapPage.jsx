import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import logo from './assets/fakelogo.png';
import './App.css';

// visualizes fish catch locations on an interactive world map using coordinates and s3 images
function MapPage() {
  const navigate = useNavigate();
  // state hooks for storing fetched data and tracking loading progress
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // refs to maintain the map instance and marker layers across re-renders
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // centralized aws configuration using environment variables
  const AWS_CONFIG = {
    region: import.meta.env.VITE_AWS_REGION,
    credentials: {
      accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
      secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    },
  };

  useEffect(() => {
    // primary data fetching function to combine database records with cloud storage images
    const fetchPhotos = async () => {
      setIsLoading(true);
      const s3Client = new S3Client(AWS_CONFIG);
      const dbClient = new DynamoDBClient(AWS_CONFIG);
      const docClient = DynamoDBDocumentClient.from(dbClient);

      try {
        // 1. check s3 for existing objects to determine if thumbnails are available for markers
        const s3Response = await s3Client.send(new ListObjectsV2Command({ 
            Bucket: "blueshuttlebucket" 
        }));
        const s3Keys = s3Response.Contents ? s3Response.Contents.map(obj => obj.Key) : [];

        // 2. retrieve all catch records from the dynamodb table
        const data = await docClient.send(new ScanCommand({ TableName: 'blueshuttle' }));
        
        // strictly filter out any records lacking valid geolocation data to prevent map errors
        const itemsWithGps = (data.Items || []).filter(item => 
          item.latitude !== undefined && 
          item.longitude !== undefined && 
          item.latitude !== null && 
          item.longitude !== null &&
          parseFloat(item.latitude) !== 0
        );

        // 3. generate temporary secure urls for each valid image or thumbnail
        const itemsWithUrls = await Promise.all(itemsWithGps.map(async (item) => {
          const fullKey = item["blueshuttle-partition"];
          const parts = fullKey.split('/');
          const folder = parts[0];
          const fileName = parts[1];
          const thumbKey = `${folder}/thumb-${fileName}`;

          // prioritize the smaller thumbnail for map performance, fall back to the full image
          const keyToSign = s3Keys.includes(thumbKey) ? thumbKey : fullKey;

          const signCommand = new GetObjectCommand({
            Bucket: "blueshuttlebucket",
            Key: keyToSign,
          });

          // create a signed url valid for one hour
          const signedUrl = await getSignedUrl(s3Client, signCommand, { expiresIn: 3600 });
          return { ...item, displayUrl: signedUrl };
        }));

        setPhotos(itemsWithUrls);
      } catch (err) {
        console.error('map fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPhotos();
  }, []);

  // initialize the leaflet map container on component mount
  useEffect(() => {
    if (!mapRef.current) {
      // create the map instance centered globally
      const map = L.map('leaflet-map', {
        zoomControl: true,
      }).setView([20, 0], 2);

      // load standard openstreetmap terrain tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; openstreetmap contributors',
      }).addTo(map);

      mapRef.current = map;
    }
  }, []);

  // synchronize markers on the map whenever the photo data changes
  useEffect(() => {
    if (!mapRef.current) return;

    // remove existing markers to prevent duplicates on data refresh
    markersRef.current.forEach(marker => mapRef.current.removeLayer(marker));
    markersRef.current = [];

    const newMarkers = [];
    photos.forEach((photo) => {
      const lat = parseFloat(photo.latitude);
      const lng = parseFloat(photo.longitude);

      // create a circular custom icon containing the fish thumbnail image
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
                background-image: url(${photo.displayUrl});
                background-size: cover;
                background-position: center;
                width: 45px;
                height: 45px;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 3px 6px rgba(0,0,0,0.4);
               "></div>`,
        iconSize: [45, 45],
        iconAnchor: [22, 45],
        popupAnchor: [0, -45]
      });

      // instantiate the marker and bind a popup with species info and timestamp
      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapRef.current);
      
      marker.bindPopup(`
        <div style="text-align:center; min-width:120px;">
          <div style="font-weight:bold; color:#333;">${photo.speciesName || 'fish'}</div>
          <img src="${photo.displayUrl}" style="width:100%; border-radius:5px; margin-top:5px;" />
          <div style="font-size:0.75rem; color:#666; margin-top:5px;">
            ${new Date(photo.timestamp).toLocaleDateString()}
          </div>
        </div>
      `);
      newMarkers.push(marker);
    });

    markersRef.current = newMarkers;

    // automatically adjust the map zoom level to fit all displayed markers
    if (newMarkers.length > 0) {
      const group = L.featureGroup(newMarkers);
      mapRef.current.fitBounds(group.getBounds().pad(0.2));
    }
  }, [photos]);

  return (
    <div className="mobile-container">
      {/* navigation header with logo and back button */}
      <header className="dashboard-header auth-header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="app-logo" />
        </div>
        <button className="menu-btn" onClick={() => navigate('/home')}>＜</button>
      </header>

      <main className="dashboard-content">
        <h1 className="app-title">Global Catch Map</h1>
        {/* container for the leaflet library to inject the map */}
        <div id="leaflet-map" style={{ 
          height: '70vh', 
          width: '90%', 
          margin: '0 auto', 
          borderRadius: '20px',
          border: '2px solid rgba(255,255,255,0.1)' 
        }}></div>
      </main>

      {/* footer navigation to return to the dashboard */}
      <footer className="dashboard-footer">
        <button className="logout-btn">
          <span className="back-arrow"></span>
        </button>
      </footer>
    </div>
  );
}

export default MapPage;
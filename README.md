# Fish Identifier AI

A fish identification application developed as part of a collaborative R&D project at the Nimbus Research Centre, Munster Technological University (MTU)

The application allows users to photograph fish, receive AI-generated species predictions, record catches and view their catch history through an image gallery, statistics dashboard and interactive map. It also supports offline image storage and later synchronisation.

## Features

- **AI Fish Identification:** Capture or select photographs for AI-based fish identification.
- **Result Confirmation:** Review AI predictions, confirm species, manually correct results or mark unidentified catches.
- **Offline Support:** Save photographs and catch information locally when an internet connection is unavailable.
- **Catch Synchronisation:** Upload previously saved catches when connectivity is restored.
- **Image Gallery:** Browse, edit and manage recorded catches.
- **Catch History:** View previous catches, including species, photographs, dates and location information.
- **Interactive Map:** Display catch locations using GPS coordinates.
- **Statistics Dashboard:** View personal catch statistics, with additional global statistics for administrator accounts.
- **User Accounts:** Register, log in and access user-specific catch records.

## Technologies Used

Frontend: React, JavaScript, HTML, CSS                    
Mobile: Capacitor, Android                              
Cloud Services: AWS S3, DynamoDB, API Gateway, Lambda 
AI Research: Amazon Rekognition, Amazon Bedrock, Fishial     
Mapping: Leaflet, OpenStreetMap                          
Image Handling: Capacitor Camera, ExifReader                    
Local Storage: Capacitor Preferences, Filesystem               
Networking: Axios, Capacitor Network                        
Other Libraries: React Router, bcryptjs                          

## AI Research

As part of the project, different approaches to fish and shark identification were researched and evaluated.

This included investigating:

- **Amazon Rekognition:** Image label detection and confidence scores.
- **Amazon Bedrock:** Claude 3 Haiku image analysis for identifying shark species.
- **Fishial:** Specialist fish identification capabilities.

The research included setting up test cases and evaluation criteria to compare the different approaches and assess their suitability for the application's requirements.

The `research/test.js` script contains experimental comparisons between Amazon Rekognition and Amazon Bedrock using a collection of sample shark images. This research was conducted separately from the application's main identification workflow.

## Application Architecture

The application uses React for its frontend and Capacitor to provide Android functionality.

Photographs are uploaded to Amazon S3 and processed through an API Gateway endpoint connected to backend services. Catch records and user information are stored in DynamoDB.

The application also uses image metadata and device GPS coordinates to associate catches with locations, while Capacitor Preferences and Filesystem support local storage and offline catch management.

## My Contribution

During my time spent on this project, I worked across both frontend and backend components, alongside research, cloud integration and software testing.

**Frontend and Backend Development**

- Contributed to the development of the React application using JavaScript, JSX and CSS.
- Worked across frontend functionality and backend service integrations.
- Implemented and worked with application features involving image uploads, user accounts, catch records and data retrieval.
- Worked with Capacitor to support Android functionality and native device features.

**Cloud Services and Integration**

- Contributed to setting up and configuring AWS services for the application, including S3, DynamoDB, API Gateway and Lambda.
- Worked with AWS S3 for image storage and DynamoDB for user and catch data.
- Explored and integrated cloud functionality involving API Gateway and AWS Lambda.
- Worked with application data flows between the frontend, cloud storage and backend services.

**AI Research and Evaluation**

- Researched and evaluated different AI image recognition services, including Amazon Rekognition, Amazon Bedrock and Fishial.
- Developed test cases and evaluation criteria to assess the suitability of different AI models for fish identification.
- Conducted comparative testing using sample fish and shark images.
- Investigated identification results and model confidence to help inform the selection of an appropriate identification solution.

**Software Testing and Quality Assurance**

- Created and executed test cases to assess application functionality.
- Conducted exploratory testing to identify unexpected behaviour and potential defects.
- Tested edge cases across application workflows, including image handling, data processing and connectivity-dependent functionality.
- Investigated issues involving offline storage, image uploads, GPS metadata and data synchronisation.
- Assessed application behaviour under different conditions and contributed to identifying areas requiring improvement.

## Known Limitations

- Image EXIF GPS extraction does not consistently return accurate locations.
- The application depends on configured AWS services and its associated backend API.
- Authentication and cloud access require further security improvements before production deployment.

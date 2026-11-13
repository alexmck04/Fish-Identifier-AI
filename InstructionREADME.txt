Node Version: v22.13.1
Capacitor Version: 8.0.2
Java: JDK 17
Android Studio is Required


To install node_modules & everything needed:

    npm install


To run the app:

    npm run dev


For syncing and opening on Android Auto:

    npm run build

    npx cap sync Android

    npx cap open Android

    # once android studio is open, wait for gradle to build the app before running
 


For placing the .env file

    check "where_to_put_env.png" to see the correct placement

Commands used:
    npm install @capacitor/core @capacitor/cli @capacitor/android   
    npm install @capacitor/camera 
    npm install @capacitor/preferences @capacitor/filesystem
    npm install @capacitor/network

    npm install exifreader 
    npm install bcryptjs 


TO BE CHANGED:

ForgotPasswordPage
- To reset a password, the user only needs to check if the email exists before allowing it to change the password.
  This should ideally be changed to have some sort of verification otherwise anyone can change someones password if they know their email.

MapPage
- Image EXIF gps locations dont work, this should be fixed to make locations more precise and show correctly on the Map
  Currently the user has an option of using their current location or not, meaning fish can be found in the city.
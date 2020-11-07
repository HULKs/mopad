import firebase from "firebase";
import "firebase/app";
import "firebase/auth";
import "firebase/database";

const config = {
    apiKey: "AIzaSyBm2uDgeqQfRqoXgDhz4psysK6n6PUWxdE",
    authDomain: "mopad-hulks.firebaseapp.com",
    databaseURL: "https://mopad-hulks.firebaseio.com",
    projectId: "mopad-hulks",
    storageBucket: "mopad-hulks.appspot.com",
    messagingSenderId: "65348878130",
    appId: "1:65348878130:web:7b7a107dc0243340f1212b"
  };

firebase.initializeApp(config);

import React, { useEffect, useState, useRef } from "react";
import { AmplifyAuthenticator } from "@aws-amplify/ui-react";
import Amplify from "aws-amplify";
import awsExports from "./aws-exports";
import Main from "./Main";
import "./App.css";

Amplify.configure(awsExports);
//Amplify.Logger.LOG_LEVEL = "DEBUG";

function App() {
  return (
    <AmplifyAuthenticator>
      <div className="App">
        <Main />
      </div>
    </AmplifyAuthenticator>
  );
}

export default App;

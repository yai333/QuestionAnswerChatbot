import React, { useEffect, useState, useRef } from "react";
import { Hub, Auth } from "aws-amplify";
import ChatWindow from "./chatWindow";
import logo from "./robot.gif";

function Main() {
  const ws = useRef(null);
  const [messageList, setMessageList] = useState([]);
  const [badge, setBadge] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(false);

  useEffect(() => {
    if (!user) {
      getCurrentUser();
    }
    Hub.listen("auth", (data) => {
      const { payload } = data;
      if (payload.data && payload.data.event === "signIn" && !user) {
        getCurrentUser();
      }
    });
  }, []);

  const getCurrentUser = () => {
    Auth.currentAuthenticatedUser({
      bypassCache: false,
    })
      .then((_user) => {
        setUser(_user);
        setupWebsocket(_user);
      })
      .catch((err) => console.log(err));
  };

  const handleClick = () => {
    setIsOpen(!isOpen);
    setBadge(0);
  };

  const setupWebsocket = (user) => {
    const { username, signInUserSession } = user;
    console.log(signInUserSession);
    if (!ws.current)
      ws.current = new WebSocket(
        `${process.env.REACT_APP_WS_URL}?token=${signInUserSession.accessToken.jwtToken}&username=${username}`
      );
    ws.current.onopen = () => {
      console.log("connected");
    };
    ws.current.onerror = (error) => {
      console.log("WebSocket Error " + JSON.stringify(error));
    };
    ws.current.onclose = function (e) {
      console.log(
        "Socket is closed. Reconnect will be attempted in 1 second.",
        e.reason
      );
      setTimeout(function () {
        setupWebsocket(user);
      }, 1000);
    };
    ws.current.onmessage = (event) => {
      const { username } = user;
      const { author, type, data: messageData, audio = "" } = JSON.parse(
        event.data
      );
      const isMe = username === author ? "me" : "them";
      if (!isOpen) {
        setBadge(+badge + 1);
      }
      setMessageList((prev) => {
        if (typeof messageData === "string") {
          return [
            ...prev,
            {
              author: isMe,
              type,
              data: { text: messageData },
            },
          ];
        } else {
          return [
            ...prev,
            {
              author: isMe,
              type,
              data: messageData,
            },
          ];
        }
      });
    };
  };

  const onMessageWasSent = (message) => {
    const { username } = user;
    const newMessage = { ...message, author: username };
    ws.current &&
      ws.current.send(
        JSON.stringify({
          action: "sendMessage",
          data: JSON.stringify(newMessage),
        })
      );
    setMessageList((prev) => {
      return [
        ...prev,
        {
          author: "me",
          type: "text",
          data: newMessage.data,
        },
      ];
    });
  };

  return (
    <>
      <header className="App-header">
        <img src={logo} alt="logo" />
        <small>
          photo from&nbsp;&nbsp;
          <a href="https://tenor.com/view/cute-robot-dance-happy-smile-gif-13716448">
            tenor.com
          </a>
        </small>
      </header>
      <ChatWindow
        messageList={messageList}
        onMessageWasSent={onMessageWasSent}
        handleClick={handleClick}
        badge={badge}
        isOpen={isOpen}
      />
    </>
  );
}

export default Main;

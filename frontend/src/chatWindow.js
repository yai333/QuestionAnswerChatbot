import React from "react";
import { Launcher } from "react-chat-window";

const ChatWindow = (props) => {
  const { onMessageWasSent, handleClick, isOpen, badge, messageList } = props;

  return (
    <div>
      <Launcher
        agentProfile={{
          teamName: "cleverbot",
          imageUrl: "./avata.png",
        }}
        onMessageWasSent={onMessageWasSent}
        messageList={messageList}
        handleClick={handleClick}
        isOpen={isOpen}
        showEmoji
        newMessagesCount={badge}
      />
    </div>
  );
};

export default ChatWindow;

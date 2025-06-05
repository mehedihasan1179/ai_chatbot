import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = document.querySelector(".file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggler-btn");
const navnarContainer = document.querySelector(".navbar");
const chatHistoryList = document.querySelector(".chat-history-item");
const menuButton = document.querySelector(".menu-button");

const API_KEY = "AIzaSyDKwoEk7nTsW_lGHy0LbunZWiIvejMIgeM";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

let userData = { message: "", file: {} };
let chatSessions = [];
let typingInterval, controller;

const createMsgElement = (content, ...className) => {
  const div = document.createElement("div");
  div.classList.add("message", ...className);
  div.innerHTML = content;
  return div;
};

const createListItem = (content, ...className) => {
  const li = document.createElement("li");
  li.classList.add(...className);
  li.innerHTML = content;
  return li;
};

const scrollToBottom = () => {
  container.scrollTo({
    top: container.scrollHeight,
    behavior: "smooth",
  });
};

// const typingEffect = (text, textElement, botMsgDiv) => {
//   textElement.innerHTML = "";
//   const words = text.split(" ");
//   let wordIndex = 0;
//   typingInterval = setInterval(() => {
//     if (wordIndex < words.length) {
//       textElement.innerHTML += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
//     } else {
//       clearInterval(typingInterval);
//       botMsgDiv.classList.remove("loading");
//       document.body.classList.remove("bot-responding");
//     }
//   }, 75);
// };

const typingEffect = (plainText, htmlText, textElement, botMsgDiv) => {
    if (!(textElement instanceof HTMLElement)) {
      // console.error("textElement is not a DOM element:", textElement);
      return;
    }
    textElement.innerHTML = "";
    const words = plainText.split(" ");
    let wordIndex = 0;
    typingInterval = setInterval(() => {
      if (wordIndex < words.length) {
        textElement.innerHTML += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      } else {
        clearInterval(typingInterval);
        textElement.innerHTML = htmlText; // Set final HTML content
        botMsgDiv.classList.remove("loading");
        document.body.classList.remove("bot-responding");
      }
    }, 75);
};



const displayChatSession = (session) => {
  chatsContainer.innerHTML = "";
  if (!session) return;

  const userMessage = session.history.find(msg => msg.role === "user");
  if (userMessage) {
    const userMsgHTML = `
      <p class="message-text">${userMessage.parts[0].text}</p>
      ${
        userMessage.parts[1]
          ? userMessage.parts[1].inline_data.isImage
            ? `<img src="data:${userMessage.parts[1].inline_data.mime_type};base64,${userMessage.parts[1].inline_data.data}" alt="" class="img-attachment" />`
            : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userMessage.parts[1].inline_data.fileName}</p>`
          : ""
      }
    `;
    const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
    chatsContainer.appendChild(userMsgDiv);
  }

  const botMessage = session.history.find(msg => msg.role === "model");
  if (botMessage) {
    const botMsgHTML = `
      <img src="./images/gemini.svg" alt="" class="avatar">
      <div class="message-content">
        <p class="message-text">${marked.parse(botMessage.parts[0].text, { gfm: true, breaks: true })}</p>
        <span class="copy-button material-symbols-rounded">content_copy</span>
      </div>
    `;
    const botMsgDiv = createMsgElement(botMsgHTML, "bot-message");
    chatsContainer.appendChild(botMsgDiv);
    addCopyButtonToCodeBlocks();
  }

  scrollToBottom();
  document.body.classList.add("chats-active");
};

const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();

  if (!userMessage || document.body.classList.contains("bot-responding")) return;

  promptInput.value = "";
  promptInput.focus();

  userData.message = userMessage;
  document.body.classList.add("bot-responding", "chats-active");
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

  const sessionId = Date.now().toString();
  const newSession = {
    id: sessionId,
    history: [{
      role: "user",
      parts: [
        { text: userMessage },
        ...(userData.file.data ? [{
          inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file),
        }] : []),
      ],
    }],
  };
  chatSessions.push(newSession);

  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    localStorage.setItem(`chatSessions_${user.uid}`, JSON.stringify(chatSessions));
  }

  const userMsgHTML = `
    <p class="message-text">${userMessage}</p>
    ${
      userData.file.data
        ? userData.file.isImage
          ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" alt="" class="img-attachment" />`
          : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`
        : ""
    }
  `;
  const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
  chatsContainer.appendChild(userMsgDiv);

  const chatHistoryListHTML = `
    <div class="chat-history-content">
      <span class="material-symbols-rounded">sort</span>
      <p class="list-text">${userMessage}</p>
    </div>
    <button class="remove-chat-btn material-symbols-rounded" title="Remove chat">close</button>
  `;
  const userMsgList = createListItem(chatHistoryListHTML, "chat-history-list");
  userMsgList.dataset.sessionId = sessionId;
  chatHistoryList.prepend(userMsgList);

  scrollToBottom();

  setTimeout(() => {
    const botMsgHTML = `
      <img src="./images/gemini.svg" alt="" class="avatar">
      <div class="message-content loader">
        <p class="message-text"></p>
        <div class="loading-indicator">
          <div class="loading-bar"></div>
          <div class="loading-bar"></div>
          <div class="loading-bar"></div>
        </div>
        <span class="copy-button material-symbols-rounded">content_copy</span>
        <span class="text-to-speech-button material-symbols-rounded">text_to_speech</span>
      </div>
    `;
    const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv, newSession);
  }, 600);
};

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = (e) => {
    fileInput.value = "";
    const base64String = e.target.result.split(",")[1];
    fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
    fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");

    userData.file = {
      fileName: file.name,
      data: base64String,
      mime_type: file.type,
      isImage,
    };
  };
});

promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());

document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
});

document.querySelector("#stop-response-btn").addEventListener("click", function() {
  userData.file = {};
  controller?.abort();
  clearInterval(typingInterval);
  document.body.classList.remove("bot-responding");
  const botMessage = chatsContainer.querySelector(".bot-message.loading");
  if (botMessage) {
    botMessage.classList.remove("loading");
  }
});

document.querySelector("#send-prompt-btn").addEventListener("click", (e) => {
  e.preventDefault();
  promptForm.dispatchEvent(new Event("submit"));
});

document.querySelector("#delete-chats-btn").addEventListener("click", () => {
    chatSessions.length = 0;
    chatsContainer.innerHTML = "";
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      localStorage.removeItem(`chatSessions_${user.uid}`);
    }
    chatHistoryList.innerHTML = "";
    chatsContainer.removeAttribute("data-session-id");
    document.body.classList.remove("bot-responding", "chats-active");
});

document.addEventListener("click", ({ target }) => {
  const wrapper = document.querySelector(".prompt-wrapper");
  const shouldHide =
    target.classList.contains("prompt-input") ||
    (wrapper.classList.contains("hide-controls") &&
      (target.id === "add-file-btn" || target.id === "stop-response-btn"));
  wrapper.classList.toggle("hide-controls", shouldHide);
});

document.querySelectorAll(".suggestion-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    promptInput.value = item.querySelector(".text").textContent;
    promptForm.dispatchEvent(new Event("submit"));
  });
});

// Theme toggle functionality
themeToggle.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
  themeToggle.textContent = isLightTheme ? "light_mode" : "dark_mode";
  // themeToggle.setAttribute("aria-label", isLightTheme ? "Switch to dark mode" : "Switch to light mode");
});

// Load theme from local storage
const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";

promptForm.addEventListener("submit", handleFormSubmit);

const addCopyButtonToCodeBlocks = () => {
  const codeBlocks = document.querySelectorAll("pre");
  codeBlocks.forEach((block) => {
    const codeElement = block.querySelector("code");
    let language =
      [...codeElement.classList]
        .find((cls) => cls.startsWith("language-"))
        ?.replace("language-", "") || "Text";

    const languageLabel = document.createElement("div");
    languageLabel.innerText = language.charAt(0).toUpperCase() + language.slice(1);
    languageLabel.classList.add("code-language-label");
    block.appendChild(languageLabel);

    const copyButton = document.createElement("button");
    copyButton.innerHTML = `<span class="material-symbols-outlined">content_copy</span>`;
    copyButton.classList.add("code-copy-btn");
    block.appendChild(copyButton);

    copyButton.addEventListener("click", () => {
      navigator.clipboard
        .writeText(codeElement.innerText)
        .then(() => {
          copyButton.innerHTML = `<span class="material-symbols-outlined">check</span>`;
          setTimeout(() => (copyButton.innerHTML = `<span class="material-symbols-outlined">content_copy</span>`), 2000);
        })
        .catch((err) => {
          console.error("Copy failed:", err);
          alert("Unable to copy text!");
        });
    });
  });
};

const actionButtons = document.querySelectorAll(".transparent-button");
const promptContainer = document.querySelector(".prompt-container");

menuButton.addEventListener('click', () => {
  navnarContainer.classList.toggle('close');
  promptContainer.classList.toggle('close');
  actionButtons.forEach((button) => {
    button.classList.toggle('close');
  });
});

function handleRemoveChatItem(e) {
  e.stopPropagation();
  const listItem = e.target.closest('.chat-history-list');
  if (listItem) {
    const sessionId = listItem.dataset.sessionId;
    const sessionIndex = chatSessions.findIndex(s => s.id === sessionId);
    if (sessionIndex !== -1) {
      chatSessions.splice(sessionIndex, 1);
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        localStorage.setItem(`chatSessions_${user.uid}`, JSON.stringify(chatSessions));
      }
    }
    listItem.remove();
    if (chatsContainer.dataset.sessionId === sessionId) {
      chatsContainer.innerHTML = "";
      chatsContainer.removeAttribute("data-session-id");
      document.classList.remove("chats-active");
    }
  }
}

function loadChatFromHistory(e) {
  const listItem = e.target.closest('.chat-history-list');
  if (listItem && !e.target.classList.contains('remove-chat-btn')) {
    const sessionId = listItem.dataset.sessionId;
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      chatsContainer.dataset.sessionId = sessionId;
      displayChatSession(session);
      promptInput.value = session.history[0].parts[0].text;
      promptInput.focus();
    }
  }
}

chatHistoryList.addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-chat-btn')) {
    handleRemoveChatItem(e);
  } else {
    loadChatFromHistory(e);
  }
});

const newChatBtn = document.querySelector(".new-chat-button");
newChatBtn.addEventListener("click", () => {
  chatSessions.length = 0;
  chatsContainer.innerHTML = "";
  document.body.classList.remove("bot-responding", "chats-active");
  window.location.reload();
});

document.querySelector('.profile-img').addEventListener('click', () => {
  document.querySelector('.profile-menu').classList.toggle('active');
});

const firebaseConfig = {
  apiKey: "AIzaSyBWEQFv2XiHMY9xRtOaieX_GllV0lCQYZ8",
  authDomain: "chatbot-ai-18fc7.firebaseapp.com",
  projectId: "chatbot-ai-18fc7",
  storageBucket: "chatbot-ai-18fc7.firebasestorage.app",
  messagingSenderId: "760212290201",
  appId: "1:760212290201:web:82ac26ce5ed617f50d9608"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

onAuthStateChanged(auth, (user) => {
  if (user) {
    const loggedInUserId = localStorage.getItem('loggedInUserId');
    if (loggedInUserId) {
      const docRef = doc(db, 'users', loggedInUserId);
      getDoc(docRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            document.getElementById('userFName').innerText = userData.firstName + " ";
            document.getElementById('userLName').innerText = userData.lastName;
            document.getElementById('user-email').innerHTML = `<span class="material-symbols-rounded">mail</span> ${userData.email}`;
          } else {
            console.log('No matching item found!');
          }
        })
        .catch((error) => {
          console.log('User id/name not found!', error);
        });
    } else {
      console.log('User ID not found in local storage');
    }
    loadChatSessions();
  } else {
    chatSessions = [];
    chatsContainer.innerHTML = "";
    chatHistoryList.innerHTML = "";
    document.body.classList.remove("bot-responding", "chats-active");
  }
});

document.getElementById('logout').addEventListener('click', () => {
  localStorage.removeItem('loggedInUserId');
  signOut(auth)
    .then(() => {
      window.location.href = 'login.html';
    })
    .catch((error) => {
      console.error('!Signing out: ', error);
    });
});

// const loadChatSessions = () => {
//   const auth = getAuth();
//   const user = auth.currentUser;
//   chatSessions = [];
//   chatHistoryList.innerHTML = '';
//   if (user) {
//     const storedSessions = localStorage.getItem(`chatSessions_${user.uid}`);
//     if (storedSessions) {
//       chatSessions = JSON.parse(storedSessions);
//       chatSessions.forEach(session => {
//         const userMessage = session.history.find(msg => msg.role === 'user');
//         if (userMessage) {
//           const chatHistoryListHTML = `
//             <div class="chat-history-content">
//               <span class="material-symbols-rounded">sort</span>
//               <p class="list-text">${userMessage.parts[0].text}</p>
//             </div>
//             <button class="remove-chat-btn material-symbols-rounded" title="Remove chat">close</button>
//           `;
//           const userMsgList = createListItem(chatHistoryListHTML, 'chat-history-list');
//           userMsgList.dataset.sessionId = session.id;
//           chatHistoryList.prepend(userMsgList);
//         }
//       });
//     }
//     console.log("Chat sessions loaded from local storage:", storedSessions);
//   }
// };

console.log("Chat sessions loaded:", chatSessions);















// Add these variables at the top with your other declarations
let currentPage = 1;
const itemsPerPage = 5;
let isLoadingHistory = false;
let showAllChats = false; // Track if we're showing all chats
let allChatSessions = []; // Store all sessions separately

// Modified loadChatSessions function
const loadChatSessions = (loadMore = false) => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!loadMore) {
    // Reset if it's initial load
    chatSessions = [];
    chatHistoryList.innerHTML = '';
    currentPage = 1;
    showAllChats = false;
  }

  if (user) {
    isLoadingHistory = true;
    
    const storedSessions = localStorage.getItem(`chatSessions_${user.uid}`);
    
    if (storedSessions) {
      allChatSessions = JSON.parse(storedSessions);
      
      // Show loading indicator when loading more
      if (loadMore && !showAllChats) {
        const loadingIndicator = createListItem('<div class="loading-history">Loading more chats...</div>');
        chatHistoryList.appendChild(loadingIndicator);
      }

      setTimeout(() => {
        // Determine which sessions to show based on current state
        let sessionsToShow;
        if (showAllChats) {
          // If showing all, just use the paginated view
          sessionsToShow = allChatSessions.slice(0, currentPage * itemsPerPage);
          showAllChats = false;
        } else if (loadMore) {
          // Regular pagination load
          currentPage++;
          sessionsToShow = allChatSessions.slice(0, currentPage * itemsPerPage);
        } else {
          // Initial load
          sessionsToShow = allChatSessions.slice(0, itemsPerPage);
        }

        chatSessions = sessionsToShow;
        
        // Clear existing items if not loading more or toggling view
        if (!loadMore || showAllChats) {
          chatHistoryList.innerHTML = '';
        } else {
          // Remove loading indicator
          const loadingIndicator = chatHistoryList.querySelector('.loading-history');
          if (loadingIndicator) {
            loadingIndicator.remove();
          }
        }

        // Render the appropriate sessions
        const startRenderIndex = loadMore && !showAllChats ? (currentPage - 1) * itemsPerPage : 0;
        
        for (let i = startRenderIndex; i < sessionsToShow.length; i++) {
          const session = sessionsToShow[i];
          const userMessage = session.history.find(msg => msg.role === 'user');
          
          if (userMessage) {
            const chatHistoryListHTML = `
              <div class="chat-history-content">
                <span class="material-symbols-rounded">sort</span>
                <p class="list-text">${userMessage.parts[0].text}</p>
              </div>
              <button class="remove-chat-btn material-symbols-rounded" title="Remove chat">close</button>
            `;
            const userMsgList = createListItem(chatHistoryListHTML, 'chat-history-list');
            userMsgList.dataset.sessionId = session.id;
            chatHistoryList.prepend(userMsgList);
          }
        }

        // Update the load more button
        updateLoadMoreButton();

        isLoadingHistory = false;
      }, 500);
    }
  }
};

// Modified function to handle showing all chats
const showAllChatHistory = () => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (user && allChatSessions.length > 0) {
    isLoadingHistory = true;
    showAllChats = true;
    
    // Clear current list
    chatHistoryList.innerHTML = '';
    
    // Show loading indicator
    const loadingIndicator = createListItem('<div class="loading-history">Loading all chats...</div>');
    chatHistoryList.appendChild(loadingIndicator);

    setTimeout(() => {
      // Show all chats
      chatSessions = [...allChatSessions];
      
      // Clear and re-render
      chatHistoryList.innerHTML = '';
      
      for (let i = 0; i < allChatSessions.length; i++) {
        const session = allChatSessions[i];
        const userMessage = session.history.find(msg => msg.role === 'user');
        
        if (userMessage) {
          const chatHistoryListHTML = `
            <div class="chat-history-content">
              <span class="material-symbols-rounded">sort</span>
              <p class="list-text">${userMessage.parts[0].text}</p>
            </div>
            <button class="remove-chat-btn material-symbols-rounded" title="Remove chat">close</button>
          `;
          const userMsgList = createListItem(chatHistoryListHTML, 'chat-history-list');
          userMsgList.dataset.sessionId = session.id;
          chatHistoryList.prepend(userMsgList);
        }
      }
      
      // Update the load more button to show "Show Less"
      updateLoadMoreButton(true);
      
      isLoadingHistory = false;
    }, 500);
  }
};

// Updated function to handle the load more button
const updateLoadMoreButton = (showLess = false) => {
  // Remove existing button if it exists
  const existingButton = chatHistoryList.querySelector('.load-more-history');
  if (existingButton) {
    existingButton.remove();
  }

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;

  const storedSessions = localStorage.getItem(`chatSessions_${user.uid}`);
  if (!storedSessions) return;

  const allSessions = JSON.parse(storedSessions);
  
  if (chatSessions.length < allSessions.length || showLess) {
    const buttonText = showLess ? "Show Less" : "Load More Chats";
    const buttonAction = showLess ? loadChatSessions : showAllChatHistory;
    
    const loadMoreButton = createListItem(
      `<button class="load-more-btn">${buttonText}</button>`,
      'load-more-history'
    );
    
    chatHistoryList.appendChild(loadMoreButton);
    
    loadMoreButton.querySelector('button').addEventListener('click', buttonAction);
  }
};

// Add this event listener to the text-to-speech button
// let speech = new SpeechSynthesisUtterance();

// document.addEventListener('click', (e) => {
//     if (e.target.classList.contains('text-to-speech-button')) {
//         const botMsgDiv = e.target.closest('.bot-message');
//         const textElement = botMsgDiv.querySelector('.message-text');
//         const textToSpeak = textElement.innerText;
        
//         if (textToSpeak) {
//             speech.text = textToSpeak;
//             window.speechSynthesis.speak(speech);
//         }
//     }
// });

let speech = new SpeechSynthesisUtterance();
let isSpeaking = false;
let pausedPosition = 0;
let fullText = '';

document.addEventListener('click', (e) => {
    const button = e.target.closest('.text-to-speech-button');
    if (!button) return;

    const botMsgDiv = button.closest('.bot-message');
    const textElement = botMsgDiv.querySelector('.message-text');
    const textToSpeak = textElement.innerText;

    if (isSpeaking) {
        // Pause the speech
        window.speechSynthesis.cancel();
        isSpeaking = false;
        // Change to play icon
        button.innerHTML = '<span class="material-symbols-rounded">play_circle</span>';
    } else {
        // Check if we're resuming or starting fresh
        const textToRead = (pausedPosition > 0) 
            ? fullText.substring(pausedPosition) 
            : textToSpeak;
        
        fullText = textToSpeak; // Store the full text for possible pausing
        
        speech.text = textToRead;
        
        // Change to pause icon
        button.innerHTML = '<span class="material-symbols-rounded">pause_circle</span>';
        
        // Speak the text
        window.speechSynthesis.speak(speech);
        isSpeaking = true;
        
        // Track position for pausing
        let utteranceStartTime;
        speech.onstart = (event) => {
            utteranceStartTime = Date.now();
        };
        
        speech.onend = () => {
            // Reset everything when done
            isSpeaking = false;
            pausedPosition = 0;
            button.innerHTML = '<span class="material-symbols-rounded">volume_up</span>';
        };
        
        // Update paused position when interrupted
        speech.onboundary = (event) => {
            if (event.name === 'word') {
                pausedPosition = fullText.indexOf(event.utterance.text.substring(event.charIndex)) + event.charIndex;
            }
        };
    }
});


// document.querySelector('button').addEventListener('click', () => {
//     speech.text = document.querySelector('textarea').value;
//     window.speechSynthesis.speak(speech);
// });


// Update your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth();
  if (auth.currentUser) {
    loadChatSessions();
  }
});

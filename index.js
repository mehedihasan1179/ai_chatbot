import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const container = document.querySelector(".container");
const mainContainer = document.querySelector(".main");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = document.querySelector(".file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggler-btn");
const navnarContainer = document.querySelector(".navbar");
const chatHistoryList = document.querySelector(".chat-history-item");
const menuButton = document.querySelector(".menu-button");


// const API_KEY = "AIzaSyDKwoEk7nTsW_lGHy0LbunZWiIvejMIgeM";
const API_KEY = "AIzaSyCUDvkmQGRJeijYSw_lAkTvBuTXTWKP3iY";
// const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`;

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
  mainContainer.scrollTo({
    top: mainContainer.scrollHeight,
    behavior: "smooth",
  });
};

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
      textElement.innerHTML +=
        (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      textElement.innerHTML = htmlText; // Set final HTML content
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
    }
  }, 75);
};


const generateResponse = async (botMsgDiv, session) => {
  const textElement = botMsgDiv.querySelector(".message-content .message-text");
  const messageContentDiv = botMsgDiv.querySelector(".message-content");
  const copyButton = botMsgDiv.querySelector(".message-content .copy-button");

  controller = new AbortController();
  const chatHistory = session.history;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    let botResponse = data.candidates[0].content.parts[0].text;

    const docstringRegex =
      /(\s*def\s+\w+\s*\(.*?\)\s*:\s*\n\s*)(['"]{3}[\s\S]*?['"]{3})/g;

    botResponse = botResponse.replace(
      docstringRegex,
      (match, funcDefStart, docstringContent) => {
        const commentedDocstring = docstringContent
          .split("\n")
          .map((line) => `# ${line}`)
          .join("\n");
        return funcDefStart + commentedDocstring;
      }
    );

    let finalBotResponseHTML = marked.parse(botResponse, {
      gfm: true,
      breaks: true,
    });

    finalBotResponseHTML = finalBotResponseHTML
      .replace(/(\*\*|__)(.+?)(\*\*|__)/g, "<strong>$2</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");


    console.log(
      "Formatted Bot Response (before code highlighting):",
      finalBotResponseHTML
    );

    // --- Start of changes for custom highlighting and code block wrappers ---
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = finalBotResponseHTML;

    tempContainer.querySelectorAll("pre code").forEach((block) => {
      const rawCode = block.textContent;
      const languageClass = Array.from(block.classList).find((cls) =>
        cls.startsWith("language-")
      );
      let languageName = "Plain Text";
      if (languageClass) {
        languageName = languageClass.replace("language-", "");
        languageName =
          languageName.charAt(0).toUpperCase() + languageName.slice(1);
      }

      const highlightedCode = highlightJSCode(rawCode, languageName); // Assuming highlightJSCode is available
      block.innerHTML = highlightedCode;

      const originalPre = block.parentNode;

      const codeBlockWrapper = document.createElement("div");
      codeBlockWrapper.classList.add("code-block-wrapper");

      const codeBlockHeader = document.createElement("div");
      codeBlockHeader.classList.add("code-block-header");

      const languageSpan = document.createElement("span");
      languageSpan.classList.add("code-language");
      languageSpan.textContent = languageName;
      codeBlockHeader.appendChild(languageSpan);

      const copyCodeBtn = document.createElement("button");
      copyCodeBtn.classList.add("copy-code-button", "material-symbols-rounded");
      copyCodeBtn.title = "Copy code";
      copyCodeBtn.textContent = "content_copy";
      copyCodeBtn.dataset.code = rawCode;
      codeBlockHeader.appendChild(copyCodeBtn);

      codeBlockWrapper.appendChild(codeBlockHeader);

      originalPre.parentNode.insertBefore(codeBlockWrapper, originalPre);
      codeBlockWrapper.appendChild(originalPre);
    });

    // After this loop, tempContainer.innerHTML contains the final, wrapped, and highlighted HTML
    finalBotResponseHTML = tempContainer.innerHTML;
    // --- End of changes for custom highlighting and code block wrappers ---

    chatsContainer.removeEventListener("click", handleCodeCopyClick); 
    chatsContainer.addEventListener("click", handleCodeCopyClick);

    const tempDivForPlainText = document.createElement("div");
    tempDivForPlainText.innerHTML = finalBotResponseHTML;
    const plainText = tempDivForPlainText.textContent.trim();

    // The typing effect should render the final HTML
    await typingEffect(plainText, finalBotResponseHTML, textElement, botMsgDiv);

    copyButton.disabled = false;
    messageContentDiv.classList.remove("loader");
    copyButton.style.display = "block";
    messageContentDiv.classList.remove("loading");

    // Store the fully processed HTML in chat history
    chatHistory.push({
      role: "model",
      parts: [{ text: finalBotResponseHTML }],
    });

    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      localStorage.setItem(
        `chatSessions_${user.uid}`,
        JSON.stringify(chatSessions)
      );
    }

    // Attach the main copy button listener only once
    if (!copyButton.__listenerAdded) {
      copyButton.addEventListener("click", () => {
        const messageContent = textElement.innerText;
        navigator.clipboard
          .writeText(messageContent)
          .then(() => {
            copyButton.innerHTML = `<button class="check material-symbols-rounded">check</button>`;
            setTimeout(() => {
              copyButton.textContent = "content_copy";
            }, 2000);
          })
          .catch((err) => {
            console.error("Failed to copy text: ", err);
            alert("Unable to copy text!");
          });
      });
      copyButton.__listenerAdded = true;
    }

  } catch (error) {
    textElement.style.color = "red";
    textElement.textContent =
      error.name === "AbortError"
        ? "Response generation stopped"
        : error.message;
    botMsgDiv.classList.remove("loader");
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    messageContentDiv.classList.remove("loader");
    messageContentDiv.classList.remove("loading");
  } finally {
    userData.file = {};
  }
};

const displayChatSession = (session) => {
  chatsContainer.innerHTML = "";
  if (!session) return;

  const userMessage = session.history.find((msg) => msg.role === "user");
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

  const botMessage = session.history.find((msg) => msg.role === "model");
  if (botMessage) {
    // Retrieve the already processed HTML from history
    const processedBotResponseHTML = botMessage.parts[0].text;

    const botMsgHTML = `
      <img src="./images/gemini.svg" alt="" class="avatar">
      <div class="message-content">
        <p class="message-text">${processedBotResponseHTML}</p>
        <div class="button-container">
          <span class="like-button material-symbols-rounded"> thumb_up </span>
          <span class="dislike-button material-symbols-rounded"> thumb_down </span>
          <span class="copy-button material-symbols-rounded">content_copy</span>
          <span class="text-to-speech-button material-symbols-rounded">text_to_speech</span>
          <span class="pdf-button material-symbols-rounded">picture_as_pdf</span>
          <span class="docx-button material-symbols-rounded">docs</span>
        </div>
      </div>
    `;
    const botMsgDiv = createMsgElement(botMsgHTML, "bot-message");
    chatsContainer.appendChild(botMsgDiv);

    const mainCopyButton = botMsgDiv.querySelector(".message-content > .copy-button");
    if (mainCopyButton && !mainCopyButton.__listenerAdded) {
      mainCopyButton.addEventListener("click", () => {
        const messageContent = botMsgDiv.querySelector(".message-text").innerText;
        navigator.clipboard
          .writeText(messageContent)
          .then(() => {
            mainCopyButton.innerHTML = `<button class="check material-symbols-rounded">check</button>`;
            setTimeout(() => {
              mainCopyButton.textContent = "content_copy";
            }, 2000);
          })
          .catch((err) => {
            console.error("Failed to copy text: ", err);
            alert("Unable to copy text!");
          });
      });
      mainCopyButton.__listenerAdded = true;
    }
  }

  scrollToBottom();
  document.body.classList.add("chats-active");
};


function handleCodeCopyClick(e) {
  const copyBtn = e.target.closest(".copy-code-button");
  if (!copyBtn) return;

  const codeToCopy =
    copyBtn.dataset.code ||
    copyBtn.closest(".code-block-wrapper")?.querySelector("code")?.textContent;

  if (!codeToCopy) return;

  navigator.clipboard
    .writeText(codeToCopy.trim())
    .then(() => {
      copyBtn.textContent = "check";
      setTimeout(() => {
        copyBtn.textContent = "content_copy";
      }, 2000);
    })
    .catch((err) => {
      console.error("Copy failed:", err);
      alert("Copy failed!");
    });
}

function highlightJSCode(code) {
  // Replace comments with a placeholder temporarily, or highlight them directly.

  // Store highlighted segments and replace them with placeholders
  const placeholders = [];
  let placeholderCounter = 0;

  const addPlaceholder = (matchedText, className) => {
    const placeholder = `__PLACEHOLDER_${placeholderCounter++}__`;
    placeholders.push({
      placeholder: placeholder,
      html: `<span class="${className}">${matchedText}</span>`,
    });
    return placeholder;
  };

  // 1. Multi-line comments: /* ... */
  code = code.replace(/(\/\*[\s\S]*?\*\/)/g, (match) =>
    addPlaceholder(match, "js-comment")
  );

  // 2. Single-line comments: // ...
  code = code.replace(/(\/\/.*)/g, (match) =>
    addPlaceholder(match, "js-comment")
  );

  code = code.replace(/(#.*)/g, (match) => addPlaceholder(match, "js-comment"));

  // 3. Strings (single and double quotes): Process after comments
  code = code.replace(/(["'`])((?:(?!\1)[^\\]|\\.)*?)\1/g, (match) =>
    addPlaceholder(match, "js-string")
  );

  code = code.replace(
    /\b((0x[0-9a-fA-F]+)|(0b[01]+)|(0o[0-7]+)|(\d+(\.\d*)?([eE][+-]?\d+)?))\b/g,
    '<span class="js-number">$&</span>'
  );

  // 5. Keywords (more generic for both JS and common Python keywords from your example)
  // Prioritize longer keywords or specific phrases if they are part of other keywords
  const keywords = ["function", "const", "return", "if", "else", "elif", "def"];
  const keywordRegex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
  code = code.replace(keywordRegex, '<span class="js-keyword">$&</span>');

  code = code.replace(
    /(\b[a-zA-Z_$][0-9a-zA-Z_$]*)\s*(?=\()/g,
    '<span class="js-function">$&</span>'
  );

  code = code.replace(
    /\b(let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\b/g,
    '<span class="js-keyword">$1</span> <span class="js-variable">$2</span>'
  );

  code = code.replace(/\b(console)\b/g, '<span class="js-variable">$&</span>');

  for (const item of placeholders) {
    code = code.replace(item.placeholder, item.html);
  }

  return code;
}

const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();

  if (!userMessage || document.body.classList.contains("bot-responding"))
    return;

  promptInput.value = "";
  promptInput.focus();

  userData.message = userMessage;
  document.body.classList.add("bot-responding", "chats-active");
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

  const sessionId = Date.now().toString();
  const newSession = {
    id: sessionId,
    history: [
      {
        role: "user",
        parts: [
          { text: userMessage },
          ...(userData.file.data
            ? [
                {
                  inline_data: (({ fileName, isImage, ...rest }) => rest)(
                    userData.file
                  ),
                },
              ]
            : []),
        ],
      },
    ],
  };
  chatSessions.push(newSession);

  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    localStorage.setItem(
      `chatSessions_${user.uid}`,
      JSON.stringify(chatSessions)
    );
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
  scrollToBottom();

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
        <div class="button-container">
          <span class="like-button material-symbols-rounded"> thumb_up </span>
          <span class="dislike-button material-symbols-rounded"> thumb_down </span>
          <span class="copy-button material-symbols-rounded">content_copy</span>
          <span class="text-to-speech-button material-symbols-rounded">text_to_speech</span>
          <span class="pdf-button material-symbols-rounded">picture_as_pdf</span>
          <span class="docx-button material-symbols-rounded">docs</span>
        </div>
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
    fileUploadWrapper.classList.add(
      "active",
      isImage ? "img-attached" : "file-attached"
    );

    userData.file = {
      fileName: file.name,
      data: base64String,
      mime_type: file.type,
      isImage,
    };
  };
});

promptForm
  .querySelector("#add-file-btn")
  .addEventListener("click", () => fileInput.click());

document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
});

document
  .querySelector("#stop-response-btn")
  .addEventListener("click", function () {
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
  // Show confirmation prompt
  const userConfirmed = confirm("Are you sure you want to remove all chat lists history?");
  
  if (userConfirmed) {
    // Clear chat data
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
  }
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

//Theme toggle fumctionality
const themeToggleLabel = document.querySelector('label[for="darkmode"]'); 
const darkmodeCheckbox = document.getElementById('darkmode');

const storedTheme = localStorage.getItem("themeColor");
if (storedTheme) {
  document.body.classList.toggle("light-theme", storedTheme === "light_mode");
  darkmodeCheckbox.checked = (storedTheme === "dark_mode"); 
}

// Add the event listener to the label element
themeToggleLabel.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
});

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
    languageLabel.innerText =
      language.charAt(0).toUpperCase() + language.slice(1);
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
          setTimeout(
            () =>
              (copyButton.innerHTML = `<span class="material-symbols-outlined">content_copy</span>`),
            2000
          );
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
const navbar = document.querySelector(".main header .menu-button");
const profileName = document.querySelector(".main header .profile-name");

menuButton.addEventListener("click", () => {
  navnarContainer.classList.toggle("close");
  promptContainer.classList.toggle("close");
  actionButtons.forEach((button) => {
    button.classList.toggle("close");
  });
  navbar.style.opacity = "1";
  profileName.style.opacity = "1";
});

navbar.addEventListener("click", () => {
    navnarContainer.classList.remove("close");
    promptContainer.classList.remove("close");
    // actionButtons.classList.remove("close");
    navbar.style.opacity = "0";
    profileName.style.opacity = "0";
});

function handleRemoveChatItem(e) {
  e.stopPropagation();
  const listItem = e.target.closest(".chat-history-list");
  if (listItem) {
    const sessionId = listItem.dataset.sessionId;
    const sessionIndex = chatSessions.findIndex((s) => s.id === sessionId);
    if (sessionIndex !== -1) {
      chatSessions.splice(sessionIndex, 1);
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        localStorage.setItem(
          `chatSessions_${user.uid}`,
          JSON.stringify(chatSessions)
        );
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
  const listItem = e.target.closest(".chat-history-list");
  if (listItem && !e.target.classList.contains("remove-chat-btn")) {
    const sessionId = listItem.dataset.sessionId;
    const session = chatSessions.find((s) => s.id === sessionId);
    if (session) {
      chatsContainer.dataset.sessionId = sessionId;
      displayChatSession(session);
      promptInput.value = session.history[0].parts[0].text;
      promptInput.focus();
    }
  }
}

chatHistoryList.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-chat-btn")) {
    handleRemoveChatItem(e);
  } else {
    loadChatFromHistory(e);
  }
});

const newChatBtn = document.querySelector(".new-chat-button");
newChatBtn.addEventListener("click", () => {
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    utterance = null;
    isPaused = false;
    document.querySelectorAll(".text-to-speech-button").forEach((button) => {
      button.innerHTML = `<span class="material-symbols-rounded">text_to_speech</span>`;
    });
  }
  // Clear only the current chat display, not the entire chatSessions
  chatsContainer.innerHTML = "";
  chatsContainer.removeAttribute("data-session-id");
  document.body.classList.remove("bot-responding", "chats-active");
  promptInput.value = ""; // Clear the input field
});

document.querySelector(".profile-img").addEventListener("click", () => {
  document.querySelector(".profile-menu").classList.toggle("active");
});

const firebaseConfig = {
  apiKey: "AIzaSyBWEQFv2XiHMY9xRtOaieX_GllV0lCQYZ8",
  authDomain: "chatbot-ai-18fc7.firebaseapp.com",
  projectId: "chatbot-ai-18fc7",
  storageBucket: "chatbot-ai-18fc7.firebasestorage.app",
  messagingSenderId: "760212290201",
  appId: "1:760212290201:web:82ac26ce5ed617f50d9608",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

onAuthStateChanged(auth, (user) => {
  if (user) {
    const loggedInUserId = localStorage.getItem("loggedInUserId");
    if (loggedInUserId) {
      const docRef = doc(db, "users", loggedInUserId);
      getDoc(docRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            document.getElementById("userFName").innerText =
              userData.firstName + " ";
            document.getElementById("userLName").innerText = userData.lastName;
            document.getElementById(
              "user-email"
            ).innerHTML = `<span class="material-symbols-rounded">mail</span> ${userData.email}`;
          } else {
            console.log("No matching item found!");
          }
        })
        .catch((error) => {
          console.log("User id/name not found!", error);
        });
    } else {
      console.log("User ID not found in local storage");
    }
    // loadChatSessions();
  } else {
    chatSessions = [];
    chatsContainer.innerHTML = "";
    chatHistoryList.innerHTML = "";
    document.body.classList.remove("bot-responding", "chats-active");
  }
});

document.getElementById("logout").addEventListener("click", () => {
  localStorage.removeItem("loggedInUserId");
  signOut(auth)
    .then(() => {
      window.location.href = "login.html";
    })
    .catch((error) => {
      console.error("!Signing out: ", error);
    });
});


const extractTextFromHTML = (html) => {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  return tempDiv.textContent.trim();
};

let utterance = null;
let isPaused = false;

document.addEventListener("click", (e) => {
  const speechButton = e.target.closest(".text-to-speech-button");
  if (!speechButton) return;

  const botMsgDiv = speechButton.closest(".bot-message");
  const textElement = botMsgDiv.querySelector(".message-text");

  const fullText = extractTextFromHTML(textElement.innerHTML);

  if (!utterance) {
    utterance = new SpeechSynthesisUtterance(fullText);
    window.speechSynthesis.speak(utterance);
    speechButton.innerHTML = `
      <span class="pause-btn material-symbols-rounded">
pause
</span>
    `;
    isPaused = false;

    utterance.onend = () => {
      speechButton.innerHTML = `
        <span class="text-to-speech-button material-symbols-rounded">
text_to_speech
</span>
      `;
      utterance = null;
      isPaused = false;
    };
  } else if (isPaused) {
    window.speechSynthesis.resume();
    speechButton.innerHTML = `
      <span class="pause-btn material-symbols-rounded">
pause
</span>
    `;
    isPaused = false;
  } else {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      speechButton.innerHTML = `
        <span class="resume-btn material-symbols-rounded">
resume
</span>
      `;
      isPaused = true;
    }
  }
});

//add functionality to voice search Button
if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.lang = "en-US";
  recognition.lang = "bn-BD";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    promptInput.value = transcript;
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
  };

  recognition.onstart = () => {
    console.log("Speech recognition started");
  };

  recognition.onend = () => {
    console.log("Speech recognition ended");
    voiceSearchBtn.classList.remove("ani");
  };

  const voiceSearchBtn = document.getElementById("voiceSearchBtn");

  voiceSearchBtn.addEventListener("click", (e) => {
    recognition.start();
    voiceSearchBtn.classList.toggle("ani");
  });
} else {
  alert("Speech recognition is not supported in this browser.");
}

//like/dislike functionality

document.addEventListener("click", (e) => {
  const likeBtn = e.target.closest(".like-button");
  const dislikeBtn = e.target.closest(".dislike-button");

  // If neither button was clicked, exit
  if (!likeBtn && !dislikeBtn) return;

  // Find the parent container to locate the sibling button
  const buttonContainer = e.target.closest(".button-container");
  if (!buttonContainer) return;

  const siblingLikeBtn = buttonContainer.querySelector(".like-button");
  const siblingDislikeBtn = buttonContainer.querySelector(".dislike-button");

  if (likeBtn) {
    likeBtn.classList.toggle("active");
    siblingDislikeBtn.classList.remove("active");
    likeBtn.innerHTML = likeBtn.classList.contains("active")
      ? `<span class="material-icons">thumb_up</span>`
      : `<span class="material-symbols-rounded">thumb_up</span>`;
    siblingDislikeBtn.innerHTML = `<span class="material-symbols-rounded">thumb_down</span>`;
  } else if (dislikeBtn) {
    dislikeBtn.classList.toggle("active");
    siblingLikeBtn.classList.remove("active");
    dislikeBtn.innerHTML = dislikeBtn.classList.contains("active")
      ? `<span class="material-icons">thumb_down</span>`
      : `<span class="material-symbols-rounded">thumb_down</span>`;
    siblingLikeBtn.innerHTML = `<span class="material-symbols-rounded">thumb_up</span>`;
  }
});

// covert text to pdf functionality

document.addEventListener("click", async (e) => {
  const pdfButton = e.target.closest(".pdf-button");
  if (!pdfButton) return;

  const botMsgDiv = pdfButton.closest(".bot-message");
  if (!botMsgDiv) return;

  const textElement = botMsgDiv.querySelector(".message-text");
  const textToPdf = textElement.innerText;

  if (!textToPdf.trim()) {
    alert("No text to convert to PDF");
    return;
  }

  async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // 1. Load the font file (TTF format)
    async function loadFont() {
      try {
        // Replace with your actual font path
        const fontUrl = "/fonts/DancingScript.ttf";
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error("Font loading failed");
        return await response.arrayBuffer();
      } catch (error) {
        console.error("Font loading error:", error);
        return null;
      }
    }

    // 2. Get the font data
    const fontData = await loadFont();

    if (!fontData) {
      console.warn("Using fallback font (Helvetica)");
      doc.setFont("helvetica");
    } else {
      try {
        // 3. Convert ArrayBuffer to binary string (required by jsPDF)
        const fontBinaryString = Array.from(new Uint8Array(fontData))
          .map((byte) => String.fromCharCode(byte))
          .join("");

        // 4. Add to virtual file system FIRST
        doc.addFileToVFS("DancingScript.ttf", fontBinaryString);

        // 5. THEN add the font
        doc.addFont("DancingScript.ttf", "DancingScript", "normal");

        // 6. FINALLY set the font
        doc.setFont("DancingScript");

        console.log("Custom font loaded successfully");
      } catch (error) {
        console.error("Font registration failed:", error);
        doc.setFont("helvetica");
      }
    }

    // Set filename
    let filename = prompt("Enter PDF filename:", "document") || "document";

    // Configure text
    doc.setFontSize(12);
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;

    // Split text into lines
    const lines = doc.splitTextToSize(textToPdf, maxWidth);

    // Add text with pagination
    let yPos = margin;
    lines.forEach((line) => {
      if (yPos > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(line, margin, yPos);
      yPos += 7; // Line height
    });

    // Save PDF
    doc.save(`${filename}.pdf`);
  }

  await generatePDF();
});

// covert text to docx functionality

document.addEventListener("click", (e) => {
  const docxButton = e.target.closest(".docx-button");
  if (!docxButton) return;

  const botMsgDiv = docxButton.closest(".bot-message");
  if (!botMsgDiv) return;

  const textElement = botMsgDiv.querySelector(".message-text");
  const textToDocx = textElement.innerText;

  class SimpleRTF {
    constructor() {
      this.content = [
        "{\\rtf1\\ansi\\deff0", // RTF header, ANSI encoding, default font 0
        "{\\fonttbl{\\f0\\fswiss\\fcharset0 Calibri;}}", // Font table: Calibri
        "{\\colortbl ;}", // Color table (empty for simplicity)
        "\\fs24", // Font size: 12pt (24 half-points)
      ];
    }

    addText(text) {
      // Escape special RTF characters and handle newlines
      const escapedText = text
        .replace(/\\/g, "\\\\")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/\n/g, "\\par ");
      this.content.push(escapedText);
    }

    save(filename) {
      // Close RTF document
      this.content.push("}");

      // Create Blob and trigger download
      const blob = new Blob([this.content.join("\n")], {
        type: "application/rtf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  function generateDOC() {
    // Create new RTF instance
    const doc = new SimpleRTF();

    // Get text input
    const text = textToDocx;

    // Prompt for filename
    let filename = prompt("Enter DOC filename (without .doc):", "document");

    // Handle filename input
    if (filename === null) {
      // User cancelled the prompt
      return;
    }
    filename = filename.trim();
    if (!filename) {
      filename = "document"; // Default filename if empty
    }

    // Add text to RTF
    doc.addText(text);

    // Save the DOC (RTF) file
    doc.save(`${filename}.docx`);
  }

  // call the function to generate DOC
  generateDOC();
});

const settingOption = document.querySelector(".setting-btn");
settingOption.addEventListener("click", () => {
  document.querySelector(".option-btn").classList.toggle("active");
});

// Event delegation for copy-button clicks
chatsContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("copy-button")) {
    // Find the closest bot-message element to get the message text
    const botMessageDiv = e.target.closest(".bot-message");
    const messageText =
      botMessageDiv.querySelector(".message-text").textContent;

    // Copy text to clipboard
    navigator.clipboard
      .writeText(messageText)
      .then(() => {
        // Show toast message
        const toastMessage = document.querySelector(".toast-message");
        toastMessage.classList.add("active");

        // Hide toast message after 2 seconds
        setTimeout(() => {
          toastMessage.classList.remove("active");
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  }
});

chatsContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("copy-code-button")) {
    // Get the raw code from the button's dataset
    const codeToCopy = e.target.dataset.code;

    // Copy text to clipboard
    navigator.clipboard
      .writeText(codeToCopy)
      .then(() => {
        // Show toast message
        const toastMessage = document.querySelector(".toast-message-code");
        toastMessage.classList.add("active");

        // Hide toast message after 2 seconds
        setTimeout(() => {
          toastMessage.classList.remove("active");
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy code: ", err);
      });
  }
});

// // Update your DOMContentLoaded event listener
// document.addEventListener("DOMContentLoaded", () => {
//   if (window.speechSynthesis.speaking) {
//     window.speechSynthesis.cancel();
//     utterance = null;
//     isPaused = false;
//     document.querySelectorAll(".text-to-speech-button").forEach((button) => {
//       button.innerHTML = `<span class="material-symbols-rounded">text_to_speech</span>`;
//     });
//   }
//   const auth = getAuth();
//   if (auth.currentUser) {
//     loadChatSessions();
//   }
// });

// Function to load chat sessions from localStorage and populate the chat history list
function loadChatSessions() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    const storedSessions = localStorage.getItem(`chatSessions_${user.uid}`);
    if (storedSessions) {
      chatSessions = JSON.parse(storedSessions);
      // Clear existing chat history list
      chatHistoryList.innerHTML = "";
      // Populate the chat history list
      chatSessions.forEach((session) => {
        const userMessage = session.history.find((msg) => msg.role === "user");
        if (userMessage) {
          const chatHistoryListHTML = `
            <div class="chat-history-content">
              <span class="material-symbols-rounded">sort</span>
              <p class="list-text">${userMessage.parts[0].text}</p>
            </div>
            <button class="remove-chat-btn material-symbols-rounded" title="Remove chat">close</button>
          `;
          const userMsgList = createListItem(chatHistoryListHTML, "chat-history-list");
          userMsgList.dataset.sessionId = session.id;
          chatHistoryList.prepend(userMsgList);
        }
      });
      // Optionally, display the most recent chat session
      if (chatSessions.length > 0) {
        const latestSession = chatSessions[chatSessions.length - 1];
        chatsContainer.dataset.sessionId = latestSession.id;
        displayChatSession(latestSession);
      }
    }
  }
}



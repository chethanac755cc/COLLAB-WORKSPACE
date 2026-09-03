import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

function Workspace({ name, roomId }) {
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [code, setCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Saved");

  const socketRef = useRef(null);
  const isRemoteChange = useRef(false);
  const saveTimeoutRef = useRef(null);

  // -----------------------------------------
  // 1. Load all files
  // -----------------------------------------

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/rooms/${roomId}/files`
        );

        if (!response.ok) {
          console.error("Could not load files");
          return;
        }

        const data = await response.json();

        setFiles(data);

        // Open first file
        if (data.length > 0) {
          setActiveFile(data[0]);
        }
      } catch (error) {
        console.error("Error loading files:", error);
      }
    };

    loadFiles();
  }, [roomId]);

  // -----------------------------------------
  // 2. Load active file code
  // -----------------------------------------

  useEffect(() => {
    if (!activeFile) return;

    const loadFileCode = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/files/${activeFile.id}`
        );

        if (!response.ok) {
          console.error("Could not load file");
          return;
        }

        const data = await response.json();

        isRemoteChange.current = true;

        setCode(data.code || "");
        setSaveStatus("Saved");
      } catch (error) {
        console.error("Error loading file:", error);
      }
    };

    loadFileCode();
  }, [activeFile]);

  // -----------------------------------------
  // 3. WebSocket connection
  // -----------------------------------------

  useEffect(() => {
    console.log("Connecting to room:", roomId);

    const socket = new WebSocket(
      `ws://localhost:8000/ws/${roomId}`
    );

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("✅ WebSocket connected");
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "code") {
          if (
            activeFile &&
            message.file_id === activeFile.id
          ) {
            isRemoteChange.current = true;
            setCode(message.code);
          }
        }
      } catch {
        // Ignore invalid messages
      }
    };

    socket.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("🔴 WebSocket disconnected");
      setConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [roomId, activeFile]);

  // -----------------------------------------
  // 4. Save file
  // -----------------------------------------

  const saveCode = (value) => {
    if (!activeFile) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus("Saving...");

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/files/${activeFile.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              code: value,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Save failed");
        }

        setSaveStatus("Saved");

        console.log("💾 File saved");
      } catch (error) {
        console.error("Error saving file:", error);
        setSaveStatus("Save failed");
      }
    }, 500);
  };

  // -----------------------------------------
  // 5. Handle editor changes
  // -----------------------------------------

  const handleEditorChange = (value) => {
    if (value === undefined) return;

    setCode(value);

    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }

    if (
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN &&
      activeFile
    ) {
      const message = {
        type: "code",
        file_id: activeFile.id,
        code: value,
      };

      socketRef.current.send(
        JSON.stringify(message)
      );
    }

    saveCode(value);
  };

  // -----------------------------------------
  // 6. Create new file
  // -----------------------------------------

  const createNewFile = async () => {
    const filename = prompt(
      "Enter filename (example: app.js)"
    );

    if (!filename || !filename.trim()) {
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/rooms/${roomId}/files`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: filename.trim(),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();

        alert(
          error.detail || "Could not create file"
        );

        return;
      }

      const newFile = await response.json();

      setFiles((currentFiles) => [
        ...currentFiles,
        newFile,
      ]);

      setActiveFile(newFile);
    } catch (error) {
      console.error("Error creating file:", error);

      alert("Could not create file");
    }
  };

  // -----------------------------------------
  // UI
  // -----------------------------------------

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#1e1e1e",
        color: "white",
      }}
    >
      {/* FILE SIDEBAR */}

      <div
        style={{
          width: "220px",
          background: "#252526",
          borderRight: "1px solid #3e3e42",
          padding: "15px",
        }}
      >
        <h3>FILES</h3>

        {files.map((file) => (
          <div
            key={file.id}
            onClick={() => setActiveFile(file)}
            style={{
              padding: "8px",
              cursor: "pointer",
              background:
                activeFile?.id === file.id
                  ? "#37373d"
                  : "transparent",
              borderRadius: "4px",
              marginBottom: "4px",
            }}
          >
            📄 {file.filename}
          </div>
        ))}

        <button
          onClick={createNewFile}
          style={{
            marginTop: "15px",
            width: "100%",
            padding: "8px",
            cursor: "pointer",
          }}
        >
          + New File
        </button>
      </div>

      {/* MAIN AREA */}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid #3e3e42",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong>
              {activeFile
                ? activeFile.filename
                : "No file selected"}
            </strong>

            <span style={{ marginLeft: "20px" }}>
              Room: {roomId}
            </span>

            <span style={{ marginLeft: "20px" }}>
              User: {name}
            </span>
          </div>

          <div>
            {connected
              ? "🟢 Connected"
              : "🔴 Disconnected"}

            <span style={{ marginLeft: "15px" }}>
              {saveStatus}
            </span>
          </div>
        </div>

        {/* EDITOR */}

        <div style={{ flex: 1 }}>
          <Editor
            height="100%"
            language="javascript"
            value={code}
            onChange={handleEditorChange}
            theme="vs-dark"
          />
        </div>
      </div>
    </div>
  );
}

export default Workspace;
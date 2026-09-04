import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

function Workspace({ name, roomId }) {
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [code, setCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Saved");

  const [documents, setDocuments] = useState([]);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [showNewFileModal, setShowNewFileModal] = useState(false);
const [newFileName, setNewFileName] = useState("");
  const API_URL = import.meta.env.VITE_API_URL;

  // -----------------------------------------
  // AI ASSISTANT
  // -----------------------------------------

  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiSources, setAiSources] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  const socketRef = useRef(null);
  const isRemoteChange = useRef(false);
  const saveTimeoutRef = useRef(null);
  const dragCounterRef = useRef(0);

  // -----------------------------------------
  // TOAST NOTIFICATIONS
  // -----------------------------------------

  const showToast = (message, type = "success") => {
    const id = Date.now() + Math.random();

    setToasts((current) => [
      ...current,
      { id, message, type },
    ]);

    setTimeout(() => {
      setToasts((current) =>
        current.filter((toast) => toast.id !== id)
      );
    }, 3000);
  };

  // -----------------------------------------
  // LEAVE ROOM
  // -----------------------------------------

  const leaveRoom = () => {
    sessionStorage.removeItem("roomId");
    window.location.href = "/";
  };

  // -----------------------------------------
  // DRAG & DROP
  // -----------------------------------------

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    if (event.dataTransfer?.items?.length) {
      setIsDraggingFile(true);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
    }
  };

  // -----------------------------------------
  // LOAD CODE FILES
  // -----------------------------------------

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/rooms/${roomId}/files`
        );

        if (!response.ok) return;

        const data = await response.json();

        setFiles(data);

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
  // LOAD DOCUMENTS
  // -----------------------------------------

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/rooms/${roomId}/documents`
        );

        if (!response.ok) return;

        const data = await response.json();

        setDocuments(data);
      } catch (error) {
        console.error("Error loading documents:", error);
      }
    };

    loadDocuments();
  }, [roomId]);

  // -----------------------------------------
  // LOAD ACTIVE CODE FILE
  // -----------------------------------------

  useEffect(() => {
    if (!activeFile) return;

    const loadFileCode = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/files/${activeFile.id}`
        );

        if (!response.ok) return;

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
  // WEBSOCKET
  // -----------------------------------------

  useEffect(() => {
    const socket = new WebSocket(
       `${WS_URL}/ws/${roomId}`
    );

    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (
          message.type === "code" &&
          activeFile &&
          message.file_id === activeFile.id
        ) {
          isRemoteChange.current = true;
          setCode(message.code);
        }
      } catch {
        // Ignore invalid messages
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      setConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [roomId, activeFile]);

  // -----------------------------------------
  // SAVE CODE
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
          `${API_URL}/api/files/${activeFile.id}`,
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
      } catch (error) {
        console.error(error);
        setSaveStatus("Save failed");
      }
    }, 500);
  };

  // -----------------------------------------
  // EDITOR CHANGE
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
      socketRef.current.send(
        JSON.stringify({
          type: "code",
          file_id: activeFile.id,
          code: value,
        })
      );
    }

    saveCode(value);
  };

  // -----------------------------------------
  // CREATE CODE FILE
  // -----------------------------------------

  const createNewFile = async () => {
  const filename = newFileName.trim();

  if (!filename) {
    showToast("Please enter a filename", "error");
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/api/rooms/${roomId}/files`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      showToast(
        data.detail || "Could not create file",
        "error"
      );
      return;
    }

    const filesResponse = await fetch(
      `${API_URL}/api/rooms/${roomId}/files`
    );

    if (!filesResponse.ok) {
      throw new Error("Could not reload files");
    }

    const updatedFiles = await filesResponse.json();

    setFiles(updatedFiles);

    const newFile = updatedFiles.find(
      (file) => file.id === data.id
    );

    if (newFile) {
      setViewingDocument(null);
      setActiveFile(newFile);
      setCode("");
    }

    setNewFileName("");
    setShowNewFileModal(false);

    showToast(`"${filename}" created`);

  } catch (error) {
    console.error("Error creating file:", error);

    showToast(
      "Could not connect to backend",
      "error"
    );
  }
};
  // -----------------------------------------
  // UPLOAD DOCUMENT
  // -----------------------------------------

  const uploadFiles = async (selectedFiles) => {
    const filesToUpload = Array.from(selectedFiles || []);
    if (!filesToUpload.length) return;

    let uploadedCount = 0;

    for (const selectedFile of filesToUpload) {
      const formData = new FormData();
      formData.append("uploaded_file", selectedFile);

      try {
        const response = await fetch(
          `${API_URL}/api/rooms/${roomId}/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          let message = "Upload failed";
          try {
            const error = await response.json();
            message = error.detail || message;
          } catch {
            // Keep default message
          }

          showToast(`${selectedFile.name}: ${message}`, "error");
          continue;
        }

        const uploadedFile = await response.json();

        setDocuments((current) => [
          ...current,
          uploadedFile,
        ]);

        uploadedCount += 1;
      } catch (error) {
        console.error(error);
        showToast(
          `${selectedFile.name}: Could not upload file`,
          "error"
        );
      }
    }

    if (uploadedCount === 1) {
      showToast("Document uploaded successfully");
    } else if (uploadedCount > 1) {
      showToast(`${uploadedCount} documents uploaded successfully`);
    }
  };

  const uploadDocument = () => {
    const input = document.createElement("input");

    input.type = "file";
    input.multiple = true;
    input.accept =
      ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp";

    input.onchange = async (event) => {
      await uploadFiles(event.target.files);
    };

    input.click();
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounterRef.current = 0;
    setIsDraggingFile(false);

    const droppedFiles = event.dataTransfer?.files;
    if (!droppedFiles?.length) return;

    await uploadFiles(droppedFiles);
  };

  // -----------------------------------------
  // DELETE DOCUMENT
  // -----------------------------------------

  const deleteDocument = async (doc) => {
    const confirmed = window.confirm(
      `Delete "${doc.filename}"?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/api/documents/${doc.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();

        showToast(
          error.detail ||
            "Could not delete document",
          "error"
        );

        return;
      }

      setDocuments((current) =>
        current.filter(
          (item) =>
            item.id !== doc.id
        )
      );

      if (
        viewingDocument?.id ===
        doc.id
      ) {
        setViewingDocument(null);
      }

      showToast(`"${doc.filename}" deleted`);
    } catch (error) {
      console.error(error);
      showToast("Could not delete document", "error");
    }
  };
  const deleteCodeFile = async (file) => {
  const confirmed = window.confirm(
    `Delete "${file.filename}"?`
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_URL}/api/files/${file.id}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const error = await response.json();

      showToast(
        error.detail || "Could not delete file",
        "error"
      );

      return;
    }

    // Remove file from sidebar
    setFiles((currentFiles) =>
      currentFiles.filter(
        (item) => item.id !== file.id
      )
    );

    // If the deleted file was active,
    // open another available file
    if (activeFile?.id === file.id) {
      setViewingDocument(null);

      const remainingFiles = files.filter(
        (item) => item.id !== file.id
      );

      if (remainingFiles.length > 0) {
        setActiveFile(remainingFiles[0]);
      } else {
        setActiveFile(null);
        setCode("");
      }
    }

    showToast(`"${file.filename}" deleted`);
  } catch (error) {
    console.error(
      "Error deleting file:",
      error
    );

    showToast("Could not delete file", "error");
  }
};

  // -----------------------------------------
  // FILE TYPE
  // -----------------------------------------

  const getFileType = (filename) => {
    const extension = filename
      .split(".")
      .pop()
      .toLowerCase();

    if (extension === "pdf")
      return "pdf";

    if (
      ["png", "jpg", "jpeg", "gif", "webp"].includes(
        extension
      )
    )
      return "image";

    if (
      ["ppt", "pptx", "doc", "docx", "xls", "xlsx"].includes(
        extension
      )
    )
      return "office";

    return "other";
  };

  // -----------------------------------------
  // FILE ICON
  // -----------------------------------------

  const getFileIcon = (filename) => {
    const extension = filename
      .split(".")
      .pop()
      .toLowerCase();

    const icons = {
      js: "◇",
      jsx: "◇",
      ts: "◇",
      tsx: "◇",
      py: "◆",
      html: "◇",
      css: "◇",
      json: "{}",
      java: "◇",
      cpp: "◇",
      c: "◇",
      pdf: "▣",
      ppt: "▣",
      pptx: "▣",
      doc: "▤",
      docx: "▤",
      xls: "▥",
      xlsx: "▥",
      txt: "≡",
      csv: "▦",
    };

    return icons[extension] || "□";
  };

  // -----------------------------------------
  // SELECT CODE FILE
  // -----------------------------------------

  const selectCodeFile = (file) => {
    setViewingDocument(null);
    setActiveFile(file);
  };

  // -----------------------------------------
  // SELECT DOCUMENT
  // -----------------------------------------

  const selectDocument = (doc) => {
    setViewingDocument(doc);
  };

  // -----------------------------------------
  // ASK AI
  // -----------------------------------------

  const askAI = async () => {
    const question = aiQuestion.trim();

    if (!question || aiLoading) return;

    setAiLoading(true);
    setAiAnswer("");
    setAiSources([]);

    try {
      const response = await fetch(
        `${API_URL}/api/rooms/${roomId}/ask`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "AI request failed"
        );
      }

      setAiAnswer(data.answer || "");
      setAiSources(data.sources || []);
    } catch (error) {
      console.error("AI error:", error);
      setAiAnswer(
        error.message ||
          "Could not connect to the AI assistant."
      );
    } finally {
      setAiLoading(false);
    }
  };

  // -----------------------------------------
  // RENDER
  // -----------------------------------------

  return (
    <div
      className="relative flex h-screen w-full flex-col overflow-hidden bg-[#0f1117] text-slate-200"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* =====================================
          TOP BAR
      ====================================== */}

      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-[#11141b] px-4">

        {/* BRAND */}

        <div className="flex items-center gap-3">


          <div>
            <div className="text-sm font-semibold tracking-wide text-white">
              CollabSpace
            </div>

            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              Collaborative Workspace
            </div>
          </div>

        </div>

        {/* ROOM */}

        <div className="hidden items-center gap-3 md:flex">

          <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-1.5">

            <span className="mr-2 text-xs text-slate-500">
              ROOM
            </span>

            <span className="font-mono text-xl font-semibold text-slate-200">
              {roomId}
            </span>

          </div>

          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${
              connected
                ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-400"
                : "border-red-900/60 bg-red-950/30 text-red-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected
                  ? "bg-emerald-400"
                  : "bg-red-400"
              }`}
            />

            {connected
              ? "Connected"
              : "Disconnected"}
          </div>

        </div>

        {/* ASK AI */}

        <button
          onClick={() => setAiOpen((current) => !current)}
          className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
            aiOpen
              ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
              : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-white hover:cursor-pointer"
          }`}
        >
          <span>✦</span>
          Ask AI
        </button>

        {/* USER + LEAVE */}

        <div className="flex items-center gap-3">

          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
            {name?.charAt(0)?.toUpperCase() || "U"}
          </div>

          <div className="hidden text-right sm:block">
            <div className="text-xs font-medium text-slate-200">
              {name}
            </div>

            <div className="text-[10px] text-slate-500">
              Collaborator
            </div>
          </div>

          <button
            onClick={leaveRoom}
            title="Leave room"
            className="flex items-center hover:cursor-pointer gap-1.5 rounded-md border border-red-900/50 bg-red-950/20 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:border-red-800/70 hover:bg-red-950/40 hover:text-red-300"
          >
           
            <span className="hidden sm:inline">Leave Room</span>
          </button>

        </div>

      </header>

      {/* =====================================
          MAIN WORKSPACE
      ====================================== */}

      <div className="flex min-h-0 flex-1">

        {/* ===================================
            SIDEBAR
        ==================================== */}

        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-[#11141b]">

          {/* EXPLORER HEADER */}

          <div className="flex h-11 items-center justify-between border-b border-slate-800 px-4">

            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Explorer
            </span>

            

          </div>

          {/* FILE LIST */}

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">

            {/* CODE */}

            <div className="mb-5">

              <div className="mb-2 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                <span>⌄</span>
                Code
              </div>

              <div className="space-y-0.5">

                {files.map((file) => (
  <div
    key={file.id}
    className={`group flex items-center rounded-md transition ${
      activeFile?.id === file.id &&
      !viewingDocument
        ? "bg-blue-600/15"
        : "hover:bg-slate-800/70"
    }`}
  >
    {/* File name */}

    <button
      onClick={() =>
        selectCodeFile(file)
      }
      className={`flex min-w-0 flex-1 items-center gap-2 hover:cursor-pointer px-2.5 py-2 text-left text-sm ${
        activeFile?.id === file.id &&
        !viewingDocument
          ? "text-blue-300"
          : "text-slate-400 group-hover:text-slate-200"
      }`}
    >
      <span className="w-5 shrink-0 text-center text-xs text-slate-500">
        {getFileIcon(file.filename)}
      </span>

      <span className="truncate">
        {file.filename}
      </span>
    </button>

    {/* Delete */}

    <button
      onClick={() =>
        deleteCodeFile(file)
      }
      title="Delete file"
      className="mr-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded text-slate-600 transition hover:bg-red-500/10 hover:text-red-400 group-hover:flex"
    >
      ×
    </button>
  </div>
))}

              </div>

              <button
                
                  onClick={() => setShowNewFileModal(true)}
               className="mt-2 flex w-full items-center gap-2 cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-500 transition hover:border-slate-600 hover:bg-slate-800 hover:text-blue-400"
              >
                <span className="w-5 text-center">
                  +
                </span>

                New File
              </button>

            </div>

            {/* DOCUMENTS */}

            <div>

              <div className="mb-2 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                <span>⌄</span>
                Documents
              </div>

              <div className="space-y-1">

                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`group flex items-center rounded-md transition ${
                      viewingDocument?.id ===
                      doc.id
                        ? "bg-blue-600/15"
                        : "hover:bg-slate-800/70"
                    }`}
                  >

                    <button
                      onClick={() =>
                        selectDocument(doc)
                      }
                      className={`flex min-w-0 flex-1 hover:cursor-pointer items-center gap-2 px-2.5 py-2 text-left text-sm ${
                        viewingDocument?.id ===
                        doc.id
                          ? "text-blue-300"
                          : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    >

                      <span className="w-5 shrink-0 text-center text-xs text-slate-500">
                        {getFileIcon(
                          doc.filename
                        )}
                      </span>

                      <span className="truncate">
                        {doc.filename}
                      </span>

                    </button>

                    <button
                      onClick={() =>
                        deleteDocument(doc)
                      }
                      title="Delete"
                      className="mr-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded text-slate-600 transition hover:bg-red-500/10 hover:text-red-400 group-hover:flex "
                    >
                      ×
                    </button>

                  </div>
                ))}

              </div>

              <button
                onClick={uploadDocument}
                className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-500 transition hover:border-slate-600 hover:bg-slate-800 hover:text-blue-400"
              >
                <span className="w-5 text-center">
                  ↑
                </span>

                Upload Document
              </button>

              <div className="mt-2 flex items-center justify-center gap-1.5 px-2 text-[10px] text-slate-600">
                <span>or</span>
                <span className="text-slate-500">
                  drag & drop files here
                </span>
              </div>

            </div>

          </div>

          {/* SIDEBAR FOOTER */}

          <div className="border-t border-slate-800 p-3">

            <div className="rounded-lg bg-slate-900/70 p-3">

              <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-600">
                Workspace
              </div>

              <div className="text-xs text-slate-400">
                {files.length} code file
                {files.length !== 1
                  ? "s"
                  : ""}{" "}
                ·{" "}
                {documents.length} document
                {documents.length !== 1
                  ? "s"
                  : ""}
              </div>

            </div>

          </div>

        </aside>

        {/* ===================================
            EDITOR AREA
        ==================================== */}

        <main className="flex min-w-0 flex-1 flex-col bg-[#0d1117]">

          {/* FILE TAB / DOCUMENT HEADER */}

          <div className="flex h-11 shrink-0 items-center border-b border-slate-800 bg-[#11141b]">

            <div className="flex h-full min-w-0 flex-1 items-center">

              {viewingDocument ? (

                <div className="flex h-full items-center gap-2 border-r border-slate-800 bg-[#0d1117] px-4 text-sm text-slate-200">

                  <span className="text-xs">
                    {getFileIcon(
                      viewingDocument.filename
                    )}
                  </span>

                  <span className="max-w-xs truncate">
                    {viewingDocument.filename}
                  </span>

                  <button
                    onClick={() =>
                      setViewingDocument(
                        null
                      )
                    }
                    className="ml-2 rounded px-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                  >
                    ×
                  </button>

                </div>

              ) : activeFile ? (

                <div className="flex h-full items-center gap-2 border-r border-slate-800 bg-[#0d1117] px-4 text-sm text-slate-200">

                  <span className="text-xs text-blue-400">
                    {getFileIcon(
                      activeFile.filename
                    )}
                  </span>

                  <span>
                    {activeFile.filename}
                  </span>

                  <span className="ml-2 text-[10px] text-emerald-500">
                    ●
                  </span>

                </div>

              ) : null}

            </div>

            {/* DOCUMENT ACTIONS */}

            {viewingDocument && (
              <div className="flex items-center gap-2 px-3">

                <a
                  href={`http://127.0.0.1:8000/api/files/${viewingDocument.id}/download`}
                  className="rounded-md border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                >
                  ↓ Download
                </a>

              </div>
            )}

            {/* SAVE STATUS */}

            {!viewingDocument && (
              <div className="px-4 text-xs text-slate-500">

                {saveStatus ===
                "Saved" ? (
                  <span className="text-emerald-500">
                    ✓ Saved
                  </span>
                ) : (
                  saveStatus
                )}

              </div>
            )}

          </div>

          {/* CONTENT */}

          <div className="min-h-0 flex-1">

            {viewingDocument ? (

              <div className="h-full w-full bg-white">

                {getFileType(
                  viewingDocument.filename
                ) === "image" ? (

                  <div className="flex h-full w-full items-center justify-center overflow-auto bg-[#181818]">

                    <img
                      src={
                        viewingDocument.file_url
                      }
                      alt={
                        viewingDocument.filename
                      }
                      className="max-h-full max-w-full object-contain"
                    />

                  </div>

                ) : getFileType(
                    viewingDocument.filename
                  ) === "office" ? (

                  <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                      viewingDocument.file_url
                    )}`}
                    title={
                      viewingDocument.filename
                    }
                    className="h-full w-full border-0"
                  />

                ) : (

                  <iframe
                    src={
                      viewingDocument.file_url
                    }
                    title={
                      viewingDocument.filename
                    }
                    className="h-full w-full border-0"
                  />

                )}

              </div>

            ) : (

              <Editor
                height="100%"
                language="javascript"
                value={code}
                onChange={
                  handleEditorChange
                }
                theme="vs-dark"
                options={{
                  minimap: {
                    enabled: true,
                  },
                  fontSize: 14,
                  padding: {
                    top: 16,
                  },
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  renderWhitespace: "selection",
                }}
              />

            )}

          </div>

          {/* ===================================
              STATUS BAR
          ==================================== */}

          <footer className="flex h-7 shrink-0 items-center justify-between border-t border-slate-800 bg-[#11141b] px-3 text-[10px] text-slate-500">

            <div className="flex items-center gap-4">

              <span
                className={
                  connected
                    ? "text-emerald-500"
                    : "text-red-400"
                }
              >
                ●{" "}
                {connected
                  ? "Connected"
                  : "Disconnected"}
              </span>

              <span>
                {files.length +
                  documents.length}{" "}
                items
              </span>

            </div>

            <div className="flex items-center gap-4">

              <span>
                Room {roomId}
              </span>

              <span>
                UTF-8
              </span>

              {!viewingDocument && (
                <span>
                  JavaScript
                </span>
              )}

            </div>

          </footer>

        </main>

      </div>

      {/* =====================================
          AI ASSISTANT PANEL
      ====================================== */}

      {aiOpen && (
        <aside className="absolute right-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] w-[380px] flex-col border-l border-slate-800 bg-[#11141b] shadow-2xl">

          {/* HEADER */}

          <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">

            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="text-blue-400">✦</span>
                Workspace AI
              </div>

              <div className="mt-0.5 text-[10px] text-slate-500">
                Ask questions about shared documents
              </div>
            </div>

            <button
              onClick={() => setAiOpen(false)}
              className="rounded-md px-2 py-1 text-slate-500 transition hover:bg-slate-800 hover:text-white"
            >
              ×
            </button>

          </div>

          {/* ANSWER AREA */}

          <div className="min-h-0 flex-1 overflow-y-auto p-4">

            {!aiAnswer && !aiLoading && (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-xs text-center">

                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-xl text-blue-400">
                    ✦
                  </div>

                  <div className="text-sm font-medium text-slate-300">
                    Ask about your documents
                  </div>

                  <div className="mt-2 text-xs leading-5 text-slate-600">
                    The AI searches the documents in this room
                    and answers using their content.
                  </div>

                </div>
              </div>
            )}

            {aiLoading && (
              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-4">

                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />

                <span className="text-xs text-slate-400">
                  Searching documents and generating answer...
                </span>

              </div>
            )}

            {aiAnswer && !aiLoading && (
              <div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">

                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-blue-400">
                    Answer
                  </div>

                  <div className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                    {aiAnswer}
                  </div>

                </div>

                {aiSources.length > 0 && (
                  <div className="mt-4">

                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Sources
                    </div>

                    <div className="space-y-2">

                      {aiSources.map((source, index) => (
                        <div
                          key={`${source.filename}-${index}`}
                          className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2"
                        >

                          <div className="truncate text-xs text-slate-300">
                            {source.filename}
                          </div>

                          <div className="mt-1 text-[10px] text-slate-600">
  {source.chunks} relevant{" "}
  {source.chunks === 1 ? "section" : "sections"}
  {" · "}
  Relevance: {source.similarity}
</div>

                        </div>
                      ))}

                    </div>

                  </div>
                )}

              </div>
            )}

          </div>

          {/* INPUT */}

          <div className="shrink-0 border-t border-slate-800 p-3">

            <div className="flex items-end gap-2">

              <textarea
                value={aiQuestion}
                onChange={(event) =>
                  setAiQuestion(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    askAI();
                  }
                }}
                placeholder="Ask something about your documents..."
                rows={3}
                className="min-h-[76px] flex-1 resize-none rounded-lg border border-slate-700 bg-[#0d1117] px-3 py-2.5 text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-blue-500/60"
              />

              <button
                onClick={askAI}
                disabled={aiLoading || !aiQuestion.trim()}
                className="rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↑
              </button>

            </div>

            <div className="mt-2 text-[10px] text-slate-600">
              Enter to ask · Shift + Enter for new line
            </div>

          </div>

        </aside>
      )}

      {/* DRAG & DROP OVERLAY */}

      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-blue-950/60 p-6 backdrop-blur-[2px]">
          <div className="flex h-full w-full max-w-3xl items-center justify-center rounded-2xl border-2 border-dashed border-blue-400/80 bg-blue-500/10">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/20 text-3xl text-blue-300">
                ↑
              </div>
              <div className="text-lg font-semibold text-white">
                Drop documents here
              </div>
              <div className="mt-1 text-sm text-blue-200/70">
                PDF, Word, Excel, PowerPoint, images and more
              </div>
              <div className="mt-3 text-xs text-blue-200/50">
                Release anywhere in the workspace
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATIONS */}

      <div className="pointer-events-none absolute right-5 top-5 z-50 flex w-[min(360px,calc(100%-2.5rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
              toast.type === "error"
                ? "border-red-900/70 bg-[#1a1115]/95 text-red-300"
                : "border-emerald-900/70 bg-[#101a16]/95 text-emerald-300"
            }`}
          >
            <span className="mt-0.5 text-base">
              {toast.type === "error" ? "!" : "✓"}
            </span>
            <span className="min-w-0 flex-1 leading-5">
              {toast.message}
            </span>
            <button
              onClick={() =>
                setToasts((current) =>
                  current.filter((item) => item.id !== toast.id)
                )
              }
              className="text-slate-500 transition hover:text-white"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {/* =====================================
    NEW FILE MODAL
====================================== */}

{showNewFileModal && (
  <div
    className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        setShowNewFileModal(false);
        setNewFileName("");
      }
    }}
  >

    <div className="w-[420px] rounded-xl border border-slate-700 bg-[#11141b] shadow-2xl">

      {/* HEADER */}

      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">

        <div>
          <div className="text-sm font-semibold text-white">
            Create New File
          </div>

          <div className="mt-1 text-[11px] text-slate-500">
            Add a new file to this workspace
          </div>
        </div>

        <button
          onClick={() => {
            setShowNewFileModal(false);
            setNewFileName("");
          }}
          className="rounded-md px-2 py-1 text-lg text-slate-500 transition hover:bg-slate-800 hover:text-white"
        >
          ×
        </button>

      </div>

      {/* BODY */}

      <div className="p-5">

        <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Filename
        </label>

        <div className="flex items-center rounded-lg border border-slate-700 bg-[#0d1117] transition focus-within:border-blue-500/60">

          <span className="pl-3 text-sm text-blue-400">
            ◇
          </span>

          <input
            autoFocus
            type="text"
            value={newFileName}
            onChange={(event) =>
              setNewFileName(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                createNewFile();
              }

              if (event.key === "Escape") {
                setShowNewFileModal(false);
                setNewFileName("");
              }
            }}
            placeholder="example.js"
            className="w-full bg-transparent px-3 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600"
          />

        </div>

        <div className="mt-2 text-[10px] text-slate-600">
          Example: main.js, app.py, index.html
        </div>

      </div>

      {/* FOOTER */}

      <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3">

        <button
          onClick={() => {
            setShowNewFileModal(false);
            setNewFileName("");
          }}
          className="rounded-md hover:cursor-pointer border border-slate-700 px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        >
          Cancel
        </button>

        <button
          onClick={createNewFile}
          disabled={!newFileName.trim()}
          className="rounded-md bg-blue-600 hover:cursor-pointer px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create File
        </button>

      </div>

    </div>

  </div>
)}
    </div>
  );
}

export default Workspace;
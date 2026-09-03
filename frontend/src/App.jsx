import { useEffect, useState } from "react";
import Workspace from "./Workspace";

function App() {
  const [name, setName] = useState(
    localStorage.getItem("userName") || ""
  );

  const [roomId, setRoomId] = useState("");

  const [createdRoom, setCreatedRoom] = useState("");

  const [workspace, setWorkspace] = useState(false);

  // Restore room ONLY after a page refresh
  useEffect(() => {
    const savedRoom = sessionStorage.getItem("roomId");

    if (
      savedRoom &&
      window.performance &&
      window.performance.navigation.type === 1
    ) {
      setRoomId(savedRoom);
      setWorkspace(true);
    }
  }, []);

  // Handle browser Back button
  useEffect(() => {
    const handlePopState = () => {
      sessionStorage.removeItem("roomId");

      setRoomId("");
      setWorkspace(false);
      setCreatedRoom("");

      // Go back to the main page
      window.history.replaceState({}, "", "/");
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const createRoom = async () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/rooms",
        {
          method: "POST",
        }
      );

      const data = await response.json();

      setCreatedRoom(data.room_id);
      setRoomId(data.room_id);
      setWorkspace(true);

      localStorage.setItem("userName", name);
      sessionStorage.setItem("roomId", data.room_id);

      window.history.pushState(
        { room: data.room_id },
        "",
        `/room/${data.room_id}`
      );
    } catch (error) {
      alert("Could not connect to backend");
    }
  };

  const joinRoom = async () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!roomId.trim()) {
      alert("Please enter a room ID");
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/rooms/${roomId}`
      );

      if (!response.ok) {
        alert("Room not found");
        return;
      }

      const data = await response.json();

      setRoomId(data.room_id);
      setWorkspace(true);

      localStorage.setItem("userName", name);
      sessionStorage.setItem("roomId", data.room_id);

      window.history.pushState(
        { room: data.room_id },
        "",
        `/room/${data.room_id}`
      );
    } catch (error) {
      alert("Could not connect to backend");
    }
  };

  if (workspace) {
    return (
      <Workspace
        name={name}
        roomId={roomId}
      />
    );
  }

  return (
    <div>
      <h1>Collaborative Workspace</h1>

      <div>
        <label>Your Name</label>
        <br />

        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <br />

      <button onClick={createRoom}>
        Create Room
      </button>

      {createdRoom && (
        <div>
          <p>Your room ID:</p>
          <h2>{createdRoom}</h2>
          <p>Share this ID with your teammate.</p>
        </div>
      )}

      <hr />

      <div>
        <label>Room ID</label>
        <br />

        <input
          type="text"
          placeholder="Enter room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
      </div>

      <br />

      <button onClick={joinRoom}>
        Join Room
      </button>
    </div>
  );
}

export default App;
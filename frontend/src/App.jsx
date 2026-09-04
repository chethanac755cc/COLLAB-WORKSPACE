import { useEffect, useState } from "react";
import Workspace from "./Workspace";

function App() {
  const [name, setName] = useState(
    localStorage.getItem("userName") || ""
  );

  const [roomId, setRoomId] = useState("");
  const [createdRoom, setCreatedRoom] = useState("");
  const [workspace, setWorkspace] = useState(false);
  const [loading, setLoading] = useState(false);

  // -----------------------------------------
  // Restore room ONLY after a page refresh
  // -----------------------------------------

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

  // -----------------------------------------
  // Handle browser Back button
  // -----------------------------------------

  useEffect(() => {
    const handlePopState = () => {
      sessionStorage.removeItem("roomId");

      setRoomId("");
      setWorkspace(false);
      setCreatedRoom("");

      window.history.replaceState({}, "", "/");
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // -----------------------------------------
  // Create Room
  // -----------------------------------------

  const createRoom = async () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/rooms`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Could not create room");
      }

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
      console.error(error);
      alert("Could not connect to backend");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------
  // Join Room
  // -----------------------------------------

  const joinRoom = async () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!roomId.trim()) {
      alert("Please enter a room ID");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/rooms/${roomId.trim()}`
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
      console.error(error);
      alert("Could not connect to backend");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------
  // Workspace
  // -----------------------------------------

  if (workspace) {
    return (
      <Workspace
        name={name}
        roomId={roomId}
      />
    );
  }

  // -----------------------------------------
  // Landing Page
  // -----------------------------------------

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090b10] text-white">

      {/* =====================================
          BACKGROUND
      ====================================== */}

      <div className="pointer-events-none absolute inset-0">

        

       

        {/* Grid */}

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #eceff4 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

      </div>

      {/* =====================================
          NAVBAR
      ====================================== */}

      <nav className="relative z-10 flex h-16 items-center justify-between border-b border-slate-800/60 bg-[#090b10]/70 px-6 backdrop-blur-xl lg:px-10">

        

        <div className="flex items-center gap-3">

          

          <div>

            <div className="text-xl font-semibold tracking-wide">
              CollabSpace
            </div>

            

          </div>

        </div>

        {/* Right */}

        <div className="flex items-center gap-2 text-xs text-slate-500">

          <span className="hidden sm:block">
            Real-time collaboration
          </span>

          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

          <span className="text-emerald-400">
            Online
          </span>

        </div>

      </nav>

      {/* =====================================
          CONTENT
      ====================================== */}

      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">

        <div className="w-full max-w-5xl">

          {/* HERO */}

          <div className="mb-5 text-center">

            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-[11px] font-medium text-blue-400">

              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />

              CODE · DOCUMENTS · COLLABORATION

            </div>

            

            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
              A shared workspace for collaborative coding,
              document management, and project collaboration.
            </p>

          </div>

          {/* =================================
              MAIN CARD
          ================================== */}

          <div className="mx-auto max-w-md">

            <div className="rounded-2xl border border-slate-800 bg-[#11141b]/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7">

              {/* NAME */}

              <div className="mb-7">

                <label className="mb-2.5 block text-xs font-medium text-slate-400">
                  Your name
                </label>

                <div className="relative">

                  {/* Avatar */}

                  <div className="pointer-events-none absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-slate-800 text-xs font-semibold text-slate-400">
                    {name?.charAt(0)?.toUpperCase() || "?"}
                  </div>

                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    className="h-11 w-full rounded-lg border border-slate-700 bg-[#0c0f15] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />

                </div>

              </div>

              {/* DIVIDER */}

              <div className="mb-6 flex items-center gap-3">

                <div className="h-px flex-1 bg-slate-800" />

                <span className="text-[10px] uppercase tracking-widest text-slate-600">
                  Workspace
                </span>

                <div className="h-px flex-1 bg-slate-800" />

              </div>

              {/* CREATE */}

              <button
                onClick={createRoom}
                disabled={loading}
                className="group mb-4 flex w-full items-center justify-between rounded-xl border border-blue-500/30 bg-blue-600 px-4 py-3.5 text-left transition hover:bg-blue-500 hover:cursor-pointer disabled:opacity-60"
              >

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-lg">
                    +
                  </div>

                  <div>

                    <div className="text-sm font-semibold text-white">
                      Create a room
                    </div>

                    <div className="mt-0.5 text-[11px] text-blue-100/60">
                      Start a new collaborative workspace
                    </div>

                  </div>

                </div>

                <span className="text-lg text-blue-100 transition group-hover:translate-x-1">
                  →
                </span>

              </button>

              {/* OR */}

              <div className="mb-4 flex items-center gap-3">

                <div className="h-px flex-1 bg-slate-800" />

                <span className="text-[10px] text-slate-600">
                  OR
                </span>

                <div className="h-px flex-1 bg-slate-800" />

              </div>

              {/* JOIN */}

              <div>

                <label className="mb-2.5 block text-xs font-medium text-slate-400">
                  Join an existing room
                </label>

                <div className="flex gap-2">

                  <input
                    type="text"
                    placeholder="Enter room ID"
                    value={roomId}
                    onChange={(e) =>
                      setRoomId(
                        e.target.value.toUpperCase()
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        joinRoom();
                      }
                    }}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#0c0f15] px-4 font-mono text-sm uppercase tracking-wider text-white outline-none transition placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />

                  <button
                    onClick={joinRoom}
                    disabled={loading}
                    className="h-11 rounded-lg border border-slate-700 bg-slate-800 px-5 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 hover:text-white cursor-pointer disabled:opacity-60"
                  >
                    Join
                  </button>

                </div>

                <p className="mt-2.5 text-[10px] text-slate-600">
                  Ask the room owner for the 6-character room ID.
                </p>

              </div>

              {/* CREATED ROOM */}

              {createdRoom && (
                <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">

                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
                    Room created
                  </div>

                  <div className="font-mono text-xl font-bold tracking-[0.25em] text-white">
                    {createdRoom}
                  </div>

                  <div className="mt-1 text-[11px] text-slate-500">
                    Share this ID with your teammate.
                  </div>

                </div>
              )}

            </div>

            

          </div>

          {/* FOOTER */}

          <div className="mt-10 text-center text-[10px] text-slate-700">
            No account required · Enter a name and start collaborating
          </div>

        </div>

      </main>

    </div>
  );
}

export default App;
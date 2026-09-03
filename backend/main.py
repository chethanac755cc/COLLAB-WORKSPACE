import os
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


connections = {}


@app.get("/")
def home():
    return {
        "message": "Collaborative Workspace API is running!"
    }


@app.get("/api/test")
def test():
    return {
        "message": "Hello from FastAPI!"
    }


@app.post("/api/rooms")
def create_room():
    room_id = uuid.uuid4().hex[:6].upper()

    # Create room
    room_response = (
        supabase
        .table("rooms")
        .insert({
            "room_code": room_id
        })
        .execute()
    )

    room_db_id = room_response.data[0]["id"]

    # Create default code file
    supabase.table("code_documents").insert({
        "room_id": room_db_id,
        "filename": "main.js",
        "code": "// Start coding together..."
    }).execute()

    return {
        "room_id": room_id
    }

@app.get("/api/rooms/{room_id}")
def join_room(room_id: str):
    room_id = room_id.upper()

    response = (
        supabase
        .table("rooms")
        .select("*")
        .eq("room_code", room_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    return {
    "room_id": response.data[0]["room_code"]
}

@app.get("/api/rooms/{room_id}/code")
def get_code(room_id: str):
    room_id = room_id.upper()

    try:
        room_response = (
            supabase
            .table("rooms")
            .select("id")
            .eq("room_code", room_id)
            .execute()
        )

        if not room_response.data:
            raise HTTPException(
                status_code=404,
                detail="Room not found"
            )

        room_db_id = room_response.data[0]["id"]

        code_response = (
            supabase
            .table("code_documents")
            .select("*")
            .eq("room_id", room_db_id)
            .limit(1)
            .execute()
        )

        if not code_response.data:
            raise HTTPException(
                status_code=404,
                detail="Code file not found"
            )

        return code_response.data[0]

    except HTTPException:
        raise

    except Exception as error:
        print("Database error while loading code:", error)

        raise HTTPException(
            status_code=503,
            detail="Database temporarily unavailable"
        )


from pydantic import BaseModel

class CodeUpdate(BaseModel):
    code: str


@app.put("/api/rooms/{room_id}/code")
def update_code(room_id: str, data: CodeUpdate):
    room_id = room_id.upper()

    try:
        # Find the room
        room_response = (
            supabase
            .table("rooms")
            .select("id")
            .eq("room_code", room_id)
            .execute()
        )

        if not room_response.data:
            raise HTTPException(
                status_code=404,
                detail="Room not found"
            )

        room_db_id = room_response.data[0]["id"]

        # Find the code document
        code_response = (
            supabase
            .table("code_documents")
            .select("id")
            .eq("room_id", room_db_id)
            .limit(1)
            .execute()
        )

        if not code_response.data:
            raise HTTPException(
                status_code=404,
                detail="Code file not found"
            )

        code_id = code_response.data[0]["id"]

        # Update code
        supabase \
            .table("code_documents") \
            .update({
                "code": data.code,
                "updated_at": "now()"
            }) \
            .eq("id", code_id) \
            .execute()

        return {
            "saved": True
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Error saving code:", error)

        raise HTTPException(
            status_code=503,
            detail="Could not save code"
        )

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    room_id = room_id.upper()

    await websocket.accept()

    connections.setdefault(room_id, []).append(websocket)

    try:
        while True:
            message = await websocket.receive_text()

            for connection in connections.get(room_id, []):
                if connection != websocket:
                    await connection.send_text(message)

    except WebSocketDisconnect:
        if websocket in connections.get(room_id, []):
            connections[room_id].remove(websocket)

        if not connections.get(room_id):
            connections.pop(room_id, None)


@app.get("/api/db-test")
def db_test():
    response = supabase.table("rooms").select("*").limit(1).execute()

    return {
        "connected": True,
        "data": response.data
    }

@app.get("/api/rooms/{room_id}/files")
def get_files(room_id: str):
    room_id = room_id.upper()

    try:
        room_response = (
            supabase
            .table("rooms")
            .select("id")
            .eq("room_code", room_id)
            .execute()
        )

        if not room_response.data:
            raise HTTPException(
                status_code=404,
                detail="Room not found"
            )

        room_db_id = room_response.data[0]["id"]

        response = (
            supabase
            .table("code_documents")
            .select("id, filename, updated_at")
            .eq("room_id", room_db_id)
            .order("filename")
            .execute()
        )

        return response.data

    except HTTPException:
        raise

    except Exception as error:
        print("Error loading files:", error)

        raise HTTPException(
            status_code=503,
            detail="Could not load files"
        )


@app.post("/api/rooms/{room_id}/files")
def create_file(room_id: str, data: dict):
    room_id = room_id.upper()

    filename = data.get("filename", "").strip()

    if not filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required"
        )

    try:
        room_response = (
            supabase
            .table("rooms")
            .select("id")
            .eq("room_code", room_id)
            .execute()
        )

        if not room_response.data:
            raise HTTPException(
                status_code=404,
                detail="Room not found"
            )

        room_db_id = room_response.data[0]["id"]

        existing = (
            supabase
            .table("code_documents")
            .select("id")
            .eq("room_id", room_db_id)
            .eq("filename", filename)
            .execute()
        )

        if existing.data:
            raise HTTPException(
                status_code=400,
                detail="File already exists"
            )

        response = (
            supabase
            .table("code_documents")
            .insert({
                "room_id": room_db_id,
                "filename": filename,
                "code": ""
            })
            .execute()
        )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as error:
        print("Error creating file:", error)

        raise HTTPException(
            status_code=503,
            detail="Could not create file"
        )


@app.get("/api/files/{file_id}")
def get_file(file_id: str):
    try:
        response = (
            supabase
            .table("code_documents")
            .select("*")
            .eq("id", file_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )

        return response.data[0]

    except HTTPException:
        raise

    except Exception as error:
        print("Error loading file:", error)

        raise HTTPException(
            status_code=503,
            detail="Could not load file"
        )


@app.put("/api/files/{file_id}")
def update_file(file_id: str, data: CodeUpdate):
    try:
        response = (
            supabase
            .table("code_documents")
            .update({
                "code": data.code,
                "updated_at": "now()"
            })
            .eq("id", file_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )

        return {
            "saved": True
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Error saving file:", error)

        raise HTTPException(
            status_code=503,
            detail="Could not save file"
        )


@app.delete("/api/files/{file_id}")
def delete_file(file_id: str):
    try:
        response = (
            supabase
            .table("code_documents")
            .delete()
            .eq("id", file_id)
            .execute()
        )

        return {
            "deleted": True
        }

    except Exception as error:
        print("Error deleting file:", error)

        raise HTTPException(
            status_code=503,
            detail="Could not delete file"
        )
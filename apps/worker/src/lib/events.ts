export type RoomEventType = "pop" | "deep3_request";

export type RoomEventStatus = "pending" | "accepted" | "rejected" | "completed";

export type RoomEventRow = {
  id: string;
  room_id: string;
  event_type: RoomEventType;
  source_user_id: string;
  target_user_id: string;
  interest_id: string;
  status: RoomEventStatus;
  created_at: string;
  responded_at: string | null;
};

export type ApiRoomEventRow = {
  id: string;
  eventType: RoomEventType;
  sourceUserId: string;
  targetUserId: string;
  interestId: string;
  status: RoomEventStatus;
  createdAt: string;
  respondedAt: string | null;
};


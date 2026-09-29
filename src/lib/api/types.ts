export type RawMember = Record<string, unknown> & {
  nickname?: unknown;
  avatar?: unknown;
};

export type LaravelMemberPage = {
  data: unknown[];
  current_page?: unknown;
  last_page?: unknown;
  total?: unknown;
};

export type PublicMember = {
  nickname: string;
  avatar: string | null;
};

export type PublicOnlineMember = PublicMember & { online: true };

export type RawChannel = Record<string, unknown> & {
  channel?: unknown;
  topic?: unknown;
};

export type RawChannelResponse = unknown[];

export type PublicRoom = {
  name: string;
  topic: string | null;
};

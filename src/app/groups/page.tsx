'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  BsPeopleFill, BsChatDots, BsPlus, BsPaperclip, BsSend,
  BsCalendarPlus, BsX, BsSearch, BsThreeDotsVertical,
  BsFileEarmarkFill, BsFileEarmarkImageFill, BsFileEarmarkPdfFill,
  BsArrowLeft, BsPersonPlusFill, BsBellFill, BsClockHistory,
  BsCheckAll, BsCalendarEvent, BsLightningChargeFill,
  BsTrash, BsDownload, BsCameraVideoFill,
} from 'react-icons/bs';
import { HiOutlineAcademicCap } from 'react-icons/hi';

// ─── Types ─────────────────────────────────────────────────────────────────

interface GroupMember {
  email: string;
  name: string;
  image: string;
  role: string;
  joinedAt: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  subject?: string;
  createdBy: string;
  createdByName: string;
  memberEmails: string[];
  members: GroupMember[];
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageBy?: string;
  createdAt: string;
}

interface Message {
  id: string;
  type: 'text' | 'file' | 'schedule';
  text?: string;
  senderEmail: string;
  senderName: string;
  senderImage?: string;
  senderRole: string;
  createdAt: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  scheduledMeetingId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileIcon(fileType?: string) {
  if (!fileType) return <BsFileEarmarkFill />;
  if (fileType.startsWith('image/')) return <BsFileEarmarkImageFill className="text-blue-400" />;
  if (fileType === 'application/pdf') return <BsFileEarmarkPdfFill className="text-red-400" />;
  return <BsFileEarmarkFill className="text-violet-400" />;
}

function getInitials(name: string) {
  return (name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getRoleBadgeColor(role: string) {
  if (role === 'teacher') return 'text-emerald-400 bg-emerald-500/15';
  if (role === 'admin') return 'text-rose-400 bg-rose-500/15';
  return 'text-violet-400 bg-violet-500/15';
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GroupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role as string;

  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch groups ──────────────────────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      setGroups(data.groups || []);
    } catch { } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchGroups();
    if (status === 'unauthenticated') router.push('/login');
  }, [status, fetchGroups, router]);

  // ── Fetch messages from active group ─────────────────────────────────────
  const fetchMessages = useCallback(async (groupId: string, append = false) => {
    if (!append) setLoadingMessages(true);
    try {
      const before = append && messages.length > 0 ? messages[0]?.createdAt : undefined;
      const url = `/api/groups/${groupId}/messages?limit=50${before ? `&before=${encodeURIComponent(before)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      const newMsgs: Message[] = data.messages || [];
      setMessages(prev => append ? [...newMsgs, ...prev] : newMsgs);
      setHasMoreMessages(data.hasMore || false);
    } catch { } finally {
      setLoadingMessages(false);
    }
  }, [messages]);

  // ── Real-time polling (every 5 seconds) ──────────────────────────────────
  useEffect(() => {
    if (!activeGroup) return;

    fetchMessages(activeGroup.id);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/groups/${activeGroup.id}/messages?limit=50`);
        const data = await res.json();
        const latestMsgs: Message[] = data.messages || [];
        setMessages(prev => {
          // Only update if there are new messages
          if (latestMsgs.length > 0 && prev.length > 0) {
            const lastId = prev[prev.length - 1]?.id;
            const hasNew = latestMsgs.some(m => m.id !== lastId && new Date(m.createdAt) > new Date(prev[prev.length - 1].createdAt));
            return hasNew ? latestMsgs : prev;
          }
          return latestMsgs.length > 0 ? latestMsgs : prev;
        });
      } catch { }
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [activeGroup?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!loadingMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loadingMessages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageText.trim() || !activeGroup || sendingMessage) return;

    setSendingMessage(true);
    const text = messageText.trim();
    setMessageText('');

    try {
      const res = await fetch(`/api/groups/${activeGroup.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type: 'text' }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, data.message]);
        // Update group last message
        setGroups(prev => prev.map(g =>
          g.id === activeGroup.id ? { ...g, lastMessage: text, lastMessageAt: new Date().toISOString() } : g
        ));
      }
    } catch { } finally {
      setSendingMessage(false);
    }
  };

  // ── Handle file upload ────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeGroup) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('groupId', activeGroup.id);

    try {
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();

      if (uploadData.url) {
        const res = await fetch(`/api/groups/${activeGroup.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'file',
            fileUrl: uploadData.url,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          }),
        });
        const data = await res.json();
        if (data.message) setMessages(prev => [...prev, data.message]);
      }
    } catch (err) {
      console.error('File upload error:', err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.subject?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin border-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex" style={{ height: '100vh', overflow: 'hidden' }}>

      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] bg-indigo-600/6 rounded-full blur-[120px]" />
      </div>

      {/* ── Groups Sidebar ──────────────────────────────────────────────── */}
      <aside className={`${showMobileList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 border-r border-border/40 bg-card/20 backdrop-blur-md flex-shrink-0`}
        style={{ height: '100vh' }}>

        {/* Sidebar Header */}
        <div className="p-4 border-b border-border/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/')} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground">
                <BsArrowLeft />
              </button>
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center">
                <HiOutlineAcademicCap className="text-sm text-white" />
              </div>
              <span className="font-bold text-sm">Groups</span>
            </div>
            {['teacher', 'admin'].includes(role) && (
              <button
                id="create-group-btn"
                onClick={() => setShowCreateModal(true)}
                className="p-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/30 transition-all"
                title="Create Group"
              >
                <BsPlus className="text-lg" />
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <BsSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
            <input
              placeholder="Search groups…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/5 border border-border/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>
        </div>

        {/* Groups List */}
        <div className="flex-1 overflow-y-auto">
          {loadingGroups ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin border-violet-500" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-violet-500/10 flex items-center justify-center">
                <BsPeopleFill className="text-2xl text-violet-400/50" />
              </div>
              <p className="text-sm text-muted-foreground">
                {groups.length === 0 ? (
                  ['teacher', 'admin'].includes(role)
                    ? 'Create your first group to start communicating with students.'
                    : 'No groups yet. Wait for your teacher to add you to a group.'
                ) : 'No groups match your search.'}
              </p>
            </div>
          ) : (
            filteredGroups.map(group => (
              <GroupListItem
                key={group.id}
                group={group}
                active={activeGroup?.id === group.id}
                currentUserEmail={session?.user?.email || ''}
                onClick={() => {
                  setActiveGroup(group);
                  setMessages([]);
                  setShowMobileList(false);
                }}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Chat Area ─────────────────────────────────────────────────────── */}
      <main className={`${!showMobileList ? 'flex' : 'hidden'} md:flex flex-1 flex-col`} style={{ height: '100vh' }}>

        {!activeGroup ? (
          // Empty state
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
              <BsChatDots className="text-4xl text-violet-400/50" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground/80">Select a group</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose a group from the sidebar to start messaging</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border/40 bg-card/20 backdrop-blur-md flex-shrink-0">
              <button
                className="md:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground"
                onClick={() => setShowMobileList(true)}
              >
                <BsArrowLeft />
              </button>

              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                {getInitials(activeGroup.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{activeGroup.name}</p>
                <p className="text-xs text-muted-foreground">
                  {activeGroup.memberEmails.length} members
                  {activeGroup.subject && ` · ${activeGroup.subject}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {['teacher', 'admin'].includes(role) && (
                  <>
                    <button
                      id="schedule-in-group-btn"
                      onClick={() => setShowScheduleModal(true)}
                      title="Schedule a meeting"
                      className="p-2 rounded-xl hover:bg-white/10 transition-colors text-muted-foreground hover:text-amber-400"
                    >
                      <BsCalendarPlus />
                    </button>
                    <button
                      id="add-member-btn"
                      onClick={() => setShowAddMember(true)}
                      title="Add member"
                      className="p-2 rounded-xl hover:bg-white/10 transition-colors text-muted-foreground hover:text-emerald-400"
                    >
                      <BsPersonPlusFill />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowGroupInfo(!showGroupInfo)}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors text-muted-foreground"
                >
                  <BsThreeDotsVertical />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3" id="messages-container">
              {/* Load more */}
              {hasMoreMessages && (
                <button
                  onClick={() => fetchMessages(activeGroup.id, true)}
                  className="self-center text-xs text-muted-foreground hover:text-foreground py-1 px-3 rounded-full border border-border/30 hover:bg-white/5 transition-all"
                >
                  <BsClockHistory className="inline mr-1" /> Load older messages
                </button>
              )}

              {loadingMessages ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin border-violet-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-violet-500/10 flex items-center justify-center">
                    <BsChatDots className="text-2xl text-violet-400/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id || i}
                    message={msg}
                    isOwn={msg.senderEmail === session?.user?.email}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="px-5 py-4 border-t border-border/40 bg-card/10 flex-shrink-0">
              <form onSubmit={handleSendMessage} className="flex items-end gap-3">
                {/* File upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl border border-border/40 hover:bg-white/10 text-muted-foreground hover:text-violet-400 transition-all flex-shrink-0"
                  title="Attach file"
                >
                  <BsPaperclip />
                </button>

                {/* Text input */}
                <div className="flex-1 relative">
                  <textarea
                    id="message-input"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                    rows={1}
                    style={{ resize: 'none', minHeight: '44px', maxHeight: '120px' }}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-border/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
                  />
                </div>

                {/* Send button */}
                <button
                  type="submit"
                  id="send-message-btn"
                  disabled={!messageText.trim() || sendingMessage}
                  className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all flex-shrink-0"
                >
                  {sendingMessage ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : <BsSend className="text-sm" />}
                </button>
              </form>
            </div>
          </>
        )}
      </main>

      {/* Group Info Panel */}
      {showGroupInfo && activeGroup && (
        <aside className="hidden lg:flex flex-col w-72 border-l border-border/40 bg-card/20 backdrop-blur-md p-4 gap-4 flex-shrink-0"
          style={{ height: '100vh', overflowY: 'auto' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Group Info</h3>
            <button onClick={() => setShowGroupInfo(false)} className="p-1 text-muted-foreground hover:text-foreground">
              <BsX />
            </button>
          </div>

          <div className="flex flex-col items-center gap-2 py-4 border-b border-border/30">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xl">
              {getInitials(activeGroup.name)}
            </div>
            <p className="font-bold">{activeGroup.name}</p>
            {activeGroup.subject && <span className="text-xs text-muted-foreground">{activeGroup.subject}</span>}
            {activeGroup.description && <p className="text-xs text-muted-foreground text-center">{activeGroup.description}</p>}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Members ({activeGroup.members.length})
            </p>
            <div className="flex flex-col gap-2">
              {activeGroup.members.map(member => (
                <div key={member.email} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600/50 to-indigo-500/50 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {getInitials(member.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                  </div>
                  {member.email === activeGroup.createdBy && (
                    <span className="text-[10px] text-amber-400">👑</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(group) => {
            setGroups(prev => [group, ...prev]);
            setShowCreateModal(false);
            setActiveGroup(group);
            setMessages([]);
          }}
        />
      )}

      {/* Add Member Modal */}
      {showAddMember && activeGroup && (
        <AddMemberModal
          group={activeGroup}
          onClose={() => setShowAddMember(false)}
          onAdded={(email) => {
            setShowAddMember(false);
            // Refresh group data
            fetch(`/api/groups/${activeGroup.id}`)
              .then(r => r.json())
              .then(data => {
                if (data.group) {
                  setActiveGroup(data.group);
                  setGroups(prev => prev.map(g => g.id === data.group.id ? data.group : g));
                }
              });
          }}
        />
      )}

      {/* Schedule Modal */}
      {showScheduleModal && activeGroup && (
        <ScheduleInGroupModal
          group={activeGroup}
          session={session}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={(message) => {
            setMessages(prev => [...prev, message]);
            setShowScheduleModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GroupListItem({ group, active, currentUserEmail, onClick }: {
  group: Group; active: boolean; currentUserEmail: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-border/20
        ${active ? 'bg-violet-600/15 border-l-2 border-l-violet-500' : 'hover:bg-white/5'}`}
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/40 to-indigo-500/40 flex items-center justify-center font-bold text-sm text-white flex-shrink-0">
        {getInitials(group.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <p className="text-sm font-semibold truncate">{group.name}</p>
          {group.lastMessageAt && (
            <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">{formatTime(group.lastMessageAt)}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {group.lastMessage || `${group.memberEmails.length} members · ${group.subject || 'No subject'}`}
        </p>
      </div>
    </button>
  );
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const isSystem = message.type === 'schedule';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <BsCalendarEvent />
          <span>{message.senderName} scheduled a meeting</span>
          {message.text && <span className="font-semibold">· {message.text}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white mb-1
        ${isOwn ? 'bg-gradient-to-br from-violet-600 to-indigo-500' : 'bg-gradient-to-br from-slate-600 to-slate-500'}`}>
        {getInitials(message.senderName)}
      </div>

      {/* Bubble */}
      <div className={`max-w-[70%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <div className="flex items-center gap-1.5 px-1">
            <p className="text-[11px] font-medium text-foreground/70">{message.senderName}</p>
            <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${getRoleBadgeColor(message.senderRole)}`}>
              {message.senderRole}
            </span>
          </div>
        )}

        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isOwn
            ? 'bg-violet-600 text-white rounded-br-md'
            : 'bg-white/8 border border-border/30 text-foreground rounded-bl-md'}`}>

          {/* File attachment */}
          {message.type === 'file' && message.fileUrl && (
            <div className="mb-2">
              {message.fileType?.startsWith('image/') ? (
                <div className="rounded-xl overflow-hidden max-w-xs">
                  <img src={message.fileUrl} alt={message.fileName} className="max-h-48 object-cover w-full" />
                </div>
              ) : (
                <a
                  href={message.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={message.fileName}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                    ${isOwn ? 'border-white/20 bg-white/10 hover:bg-white/20' : 'border-border/40 bg-white/5 hover:bg-white/10'}`}
                >
                  <span className="text-xl">{getFileIcon(message.fileType)}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{message.fileName}</p>
                    <p className={`text-[10px] ${isOwn ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {formatFileSize(message.fileSize)}
                    </p>
                  </div>
                  <BsDownload className="flex-shrink-0 opacity-70" />
                </a>
              )}
            </div>
          )}

          {/* Text */}
          {message.text && (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          )}
        </div>

        {/* Timestamp */}
        <p className={`text-[10px] px-1 ${isOwn ? 'text-right text-muted-foreground/60' : 'text-muted-foreground/60'}`}>
          {formatTime(message.createdAt)}
          {isOwn && <BsCheckAll className="inline ml-1 text-violet-400/60" />}
        </p>
      </div>
    </div>
  );
}

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (g: Group) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Group name is required.'); return; }
    setIsLoading(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, subject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create group');
      onCreated(data.group);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-border/50 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BsPeopleFill className="text-violet-400" /> Create Group
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><BsX /></button>
        </div>

        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 mb-4">{error}</div>}

        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Group Name *</label>
            <input id="group-name-input" type="text" placeholder="e.g. CS Engineering 2024" value={name} onChange={e => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Subject / Course</label>
            <input id="group-subject-input" type="text" placeholder="e.g. Data Structures" value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea id="group-desc-input" placeholder="What is this group about?" value={description} onChange={e => setDescription(e.target.value)}
              rows={2} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm resize-none" />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-border/50 text-sm text-muted-foreground hover:bg-white/5 transition-all">Cancel</button>
            <button id="create-group-submit" type="submit" disabled={isLoading}
              className="flex-1 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {isLoading && <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>}
              {isLoading ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddMemberModal({ group, onClose, onAdded }: { group: Group; onClose: () => void; onAdded: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required.'); return; }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addMemberEmail: email.toLowerCase().trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add member');
      setSuccess(`${email} has been added to the group!`);
      setTimeout(() => { onAdded(email); }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-sm rounded-2xl border border-border/50 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BsPersonPlusFill className="text-emerald-400" /> Add Member
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><BsX /></button>
        </div>

        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 mb-4">{error}</div>}
        {success && <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400 mb-4">{success}</div>}

        <p className="text-sm text-muted-foreground mb-4">
          Enter the Gmail address of the student or teacher to add. They&apos;ll receive a notification.
        </p>

        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <input id="add-member-email" type="email" placeholder="student@gmail.com" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm" />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-border/50 text-sm text-muted-foreground hover:bg-white/5 transition-all">Cancel</button>
            <button id="add-member-submit" type="submit" disabled={isLoading}
              className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {isLoading ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleInGroupModal({ group, session, onClose, onScheduled }: {
  group: Group; session: any; onClose: () => void; onScheduled: (msg: Message) => void;
}) {
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState('60');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt) { setError('Title and time are required.'); return; }

    setIsLoading(true);
    setError('');

    try {
      // 1. Create the scheduled meeting
      const roomId = Math.random().toString(36).substring(2, 10);
      const meetRes = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          roomId,
          scheduledAt,
          duration: parseInt(duration),
          groupId: group.id,
        }),
      });
      const meetData = await meetRes.json();
      if (!meetRes.ok) throw new Error(meetData.error || 'Failed to schedule meeting');

      const meetingId = meetData.meeting?.id || meetData.id;

      // 2. Send a schedule message to the group
      const msgRes = await fetch(`/api/groups/${group.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'schedule',
          text: `📅 ${title} — ${new Date(scheduledAt).toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (${duration} min) | Room: ${roomId}`,
          scheduledMeetingId: meetingId,
        }),
      });
      const msgData = await msgRes.json();

      // 3. Notify group members
      const notifyEmails = group.members
        .filter(m => m.email !== session?.user?.email)
        .map(m => m.email);

      if (notifyEmails.length > 0) {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: notifyEmails,
            subject: `📅 Meeting Scheduled: ${title} — ${group.name}`,
            type: 'group_schedule',
            groupName: group.name,
            senderName: session?.user?.name || 'Teacher',
            scheduledTime: new Date(scheduledAt).toLocaleString('en-IN'),
          }),
        }).catch(() => { });
      }

      if (msgData.message) onScheduled(msgData.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Default to 1 hour from now
  const minDateTime = new Date();
  minDateTime.setMinutes(minDateTime.getMinutes() + 5);
  const minStr = minDateTime.toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-border/50 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BsCalendarPlus className="text-amber-400" /> Schedule Meeting
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><BsX /></button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">Schedule a meeting for <strong>{group.name}</strong>. All members will be notified via Gmail.</p>

        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 mb-4">{error}</div>}

        <form onSubmit={handleSchedule} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Meeting Title *</label>
            <input type="text" placeholder="e.g. Data Structures Lecture 5" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date & Time *</label>
              <input type="datetime-local" value={scheduledAt} min={minStr} onChange={e => setScheduledAt(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Duration (min)</label>
              <select value={duration} onChange={e => setDuration(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm">
                {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description (optional)</label>
            <textarea placeholder="What will be covered in this session?" value={description} onChange={e => setDescription(e.target.value)}
              rows={2} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm resize-none" />
          </div>

          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-2">
            <BsBellFill className="text-amber-400 mt-0.5 flex-shrink-0 text-sm" />
            <p className="text-xs text-muted-foreground">All {group.memberEmails.length - 1} members will receive an email notification with the meeting details.</p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-border/50 text-sm text-muted-foreground hover:bg-white/5 transition-all">Cancel</button>
            <button id="schedule-submit-btn" type="submit" disabled={isLoading}
              className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {isLoading && <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>}
              <BsLightningChargeFill className="text-xs" />
              {isLoading ? 'Scheduling…' : 'Schedule & Notify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

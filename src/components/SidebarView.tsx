import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    BsSend, BsPaperclip, BsFilePdf, BsFileEarmarkPpt, BsDownload, BsMicMute
} from 'react-icons/bs';

export interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    timestamp: number;
    file?: {
        url: string;
        name: string;
        type: string;
        size: number;
    };
}

export interface Participant {
    id: string;
    name: string;
    isMuted: boolean;
    isCamOff: boolean;
    isHandRaised: boolean;
    stream?: MediaStream;
}

interface SidebarViewProps {
    roomId: string;
    userName: string;
    socket: any;
    activeSidebar: 'chat' | 'participants' | null;
    setActiveSidebar: (val: 'chat' | 'participants' | null) => void;
    participants: Participant[];
    chatMessages: ChatMessage[];
    setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    chatScrollRef: React.RefObject<HTMLDivElement | null>;
    isTeacher: boolean;
    styles: any;
}

export const SidebarView: React.FC<SidebarViewProps> = ({
    roomId,
    userName,
    socket,
    activeSidebar,
    setActiveSidebar,
    participants,
    chatMessages,
    setChatMessages,
    chatScrollRef,
    isTeacher,
    styles,
}) => {
    const [newMessage, setNewMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;
        const msg: ChatMessage = {
            id: Date.now().toString(),
            sender: userName,
            text: newMessage,
            timestamp: Date.now(),
        };
        socket.emit('send-message', roomId, msg);
        setChatMessages((prev: ChatMessage[]) => [...prev, msg]);
        setNewMessage('');
        setTimeout(() => {
            if (chatScrollRef.current)
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }, 100);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !socket) return;
        setUploadError(null);
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Upload failed');
            }
            const { url, name, type, size } = await res.json();
            const fileMsg: ChatMessage = {
                id: Date.now().toString(),
                sender: userName,
                text: '',
                timestamp: Date.now(),
                file: { url, name, type, size },
            };
            socket.emit('share-file', roomId, fileMsg);
            setChatMessages((prev: ChatMessage[]) => [...prev, fileMsg]);
            setTimeout(() => {
                if (chatScrollRef.current)
                    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }, 100);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Upload failed';
            setUploadError(message);
            setTimeout(() => setUploadError(null), 4000);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className={`${styles.sidebar} ${!activeSidebar ? styles.sidebarHidden : ''}`}>
            {/* Sidebar Header */}
            <div className={styles.sidebarHeader}>
                <span>{activeSidebar === 'chat' ? 'In-Call Messages' : `Participants (${participants.length})`}</span>
                <Button variant="ghost" size="icon" onClick={() => setActiveSidebar(null)}>✕</Button>
            </div>

            {/* Sidebar Content */}
            <div className={styles.sidebarContent}>
                {activeSidebar === 'chat' ? (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 space-y-4 overflow-y-auto" ref={chatScrollRef as any}>
                            {chatMessages.length === 0 && (
                                <div className="text-center text-muted-foreground mt-10 text-sm">
                                    No messages yet.
                                </div>
                            )}
                            {chatMessages.map(msg => (
                                <div key={msg.id} className="flex flex-col gap-1">
                                    <div className="flex justify-between items-baseline">
                                        <span className="font-bold text-sm">{msg.sender}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    {msg.file ? (
                                        <a
                                            href={msg.file.url}
                                            download={msg.file.name}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 bg-secondary/50 hover:bg-secondary/80 transition-colors p-3 rounded-lg border border-border/40 group"
                                        >
                                            <div className="text-2xl flex-shrink-0">
                                                {msg.file.type === 'application/pdf'
                                                    ? <BsFilePdf className="text-red-400" />
                                                    : <BsFileEarmarkPpt className="text-orange-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{msg.file.name}</p>
                                                <p className="text-xs text-muted-foreground">{(msg.file.size / 1024).toFixed(0)} KB</p>
                                            </div>
                                            <BsDownload className="text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                                        </a>
                                    ) : (
                                        <div className="bg-secondary/50 p-2 rounded-lg text-sm">{msg.text}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {participants.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                                        {p.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <span className="font-medium text-sm">{p.name}</span>
                                        {p.id === 'local' && (
                                            <span className="ml-1 text-xs text-primary">
                                                {isTeacher ? '· Teacher' : '· You'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 text-muted-foreground">
                                    {p.isMuted && <BsMicMute size={14} />}
                                    {p.isHandRaised && <span title="Hand raised">✋</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Chat Input */}
            {activeSidebar === 'chat' && (
                <form onSubmit={handleSendMessage} className={styles.chatInputArea}>
                    {uploadError && (
                        <div className="mb-2 px-2 py-1 bg-red-500/10 border border-red-500/40 rounded text-xs text-red-400">
                            {uploadError}
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            title="Share PDF or PowerPoint"
                            disabled={isUploading}
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-border/50 hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                            {isUploading
                                ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                : <BsPaperclip className="text-muted-foreground" />}
                        </button>
                        <Input
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            className="bg-background/50"
                        />
                        <Button type="submit" size="icon" variant="primary" disabled={!newMessage.trim()}>
                            <BsSend className="text-sm" />
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
};

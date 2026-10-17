'use client';

import { endVoiceSession, startVoiceSession } from "@/lib/actions/session.actions";
import { IBook, Messages } from "@/types";
import { useAuth } from "@clerk/nextjs";
import { useSubscriptionPlan } from '@/hooks/useSubscriptionPlan';
import { useCallback, useRef, useState, useEffect } from "react";
import Vapi from '@vapi-ai/web';

export type CallStatus = 'idle' | 'connecting' | 'starting' | 'listening' | 'thinking' | 'speaking';

type VapiTranscriptMessage = {
    role: 'assistant' | 'user';
    transcriptType: 'partial' | 'final';
    transcript: string;
    id?: string;
    messageId?: string;
    utteranceId?: string;
};

const isVapiTranscriptMessage = (message: unknown): message is VapiTranscriptMessage => {
    if (!message || typeof message !== 'object') return false;

    const candidate = message as Record<string, unknown>;
    return (
        (candidate.type === 'transcript' || candidate.type === "transcript[transcriptType='final']") &&
        (candidate.role === 'assistant' || candidate.role === 'user') &&
        (candidate.transcriptType === 'partial' || candidate.transcriptType === 'final') &&
        typeof candidate.transcript === 'string'
    );
};

const useLatestRef = <T>(value: T) => {
    const ref = useRef(value);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref;
};

const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const TIMER_INTERVAL_MS = 1000;
const SECONDS_PER_MINUTE = 60;

let vapi: InstanceType<typeof Vapi>;

function getVapi() {
    if (!vapi) {
        if (!VAPI_API_KEY) {
            throw new Error('NEXT_PUBLIC_VAPI_API_KEY environment variable is not set');
        }
        vapi = new Vapi(VAPI_API_KEY);
    }
    return vapi;
}

export const useVapi = (book: IBook) => {
    const { userId } = useAuth();
    const { limits } = useSubscriptionPlan();

    const [status, setStatus] = useState<CallStatus>('idle');
    const [messages, setMessages] = useState<Messages[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [currentUserMessage, setCurrentUserMessage] = useState('');
    const [duration, setDuration] = useState(0);
    const [limitError, setLimitError] = useState<string | null>(null);
    const [callError, setCallError] = useState<string | null>(null);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const seenTranscriptIdsRef = useRef<Set<string>>(new Set());
    const isStoppingRef = useRef<boolean>(false);
    const finalizingSessionRef = useRef<string | null>(null);
    const [isBillingError, setIsBillingError] = useState(false);

    const maxDurationSeconds = limits?.maxSessionMinutes ? limits.maxSessionMinutes * SECONDS_PER_MINUTE : (15 * 60);
    const maxDurationRef = useLatestRef(maxDurationSeconds);
    const durationRef = useLatestRef(duration);

    const isActive = status === 'listening' || status === 'thinking' || status === 'speaking' || status === 'starting';

    const finalizeSession = useCallback(async (sessionId: string, durationSeconds: number) => {
        if (finalizingSessionRef.current === sessionId) return false;

        finalizingSessionRef.current = sessionId;
        try {
            const result = await endVoiceSession(sessionId, durationSeconds);
            if (!result.success) {
                console.error('Error ending voice session', result.error);
                return false;
            }

            if (sessionIdRef.current === sessionId) sessionIdRef.current = null;
            return true;
        } catch (e) {
            console.error('Error ending voice session', e);
            return false;
        } finally {
            finalizingSessionRef.current = null;
        }
    }, []);

    useEffect(() => {
        const client = getVapi();

        const handleCallStart = () => {
            isStoppingRef.current = false;
            seenTranscriptIdsRef.current.clear();
            setStatus('starting');
            setDuration(0);
            durationRef.current = 0;
            setCurrentMessage('');
            setCurrentUserMessage('');
            
            startTimeRef.current = Date.now();
            if (timerRef.current) clearInterval(timerRef.current);
            
            timerRef.current = setInterval(() => {
                if (startTimeRef.current !== null) {
                    const elapsed = Math.floor((Date.now() - startTimeRef.current) / TIMER_INTERVAL_MS);
                    setDuration(elapsed);
                    durationRef.current = elapsed;

                    if (elapsed >= maxDurationRef.current) {
                        getVapi().stop();
                        setLimitError(
                            `Session time limit (${Math.floor(maxDurationRef.current / SECONDS_PER_MINUTE)} minutes) reached. Upgrade your plan for longer sessions.`
                        );
                    }
                }
            }, TIMER_INTERVAL_MS);
        };

        const handleSpeechStart = () => {
            if (!isStoppingRef.current) setStatus('speaking');
        };

        const handleSpeechEnd = () => {
            if (!isStoppingRef.current) setStatus('listening');
        };

        const handleVapiError = (error: unknown) => {
            console.error('Vapi call or audio error', error);
            
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            if (errorMessage.includes('timeout') || errorMessage.includes('silence')) {
                setLimitError('Session ended due to inactivity. Click the mic to start again.');
            } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
                setLimitError('Connection lost. Please check your internet and try again.');
            } else {
                setCallError('Vapi could not start or play the assistant audio. Check the browser console and audio permissions.');
            }
        };

        const handleCallEnd = async () => {
            setStatus('idle');
            setCurrentMessage('');
            setCurrentUserMessage('');
            
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            const sessionId = sessionIdRef.current;
            const elapsed = startTimeRef.current === null
                ? durationRef.current
                : Math.floor((Date.now() - startTimeRef.current) / TIMER_INTERVAL_MS);
            
            startTimeRef.current = null;
            setDuration(elapsed);
            durationRef.current = elapsed;

            if (!sessionId || finalizingSessionRef.current === sessionId) return;
            await finalizeSession(sessionId, elapsed);
        };

        const handleMessage = (message: unknown) => {
            if (!isVapiTranscriptMessage(message)) return;

            const isUser = message.role === 'user';
            const setCurrentTranscript = isUser ? setCurrentUserMessage : setCurrentMessage;
            
            if (message.transcriptType === 'partial') {
                setCurrentTranscript(message.transcript);
                if (!isUser) setStatus('speaking');
                return;
            }

            setCurrentTranscript('');
            setStatus(isUser ? 'thinking' : 'listening');

            const transcriptId = message.messageId ?? message.utteranceId ?? message.id;
            if (transcriptId) {
                if (seenTranscriptIdsRef.current.has(transcriptId)) return;
                seenTranscriptIdsRef.current.add(transcriptId);
            }

            setMessages((currentMessages) => {
                return [...currentMessages, { role: message.role, content: message.transcript }];
            });
        };

        client.on('call-start', handleCallStart);
        client.on('call-end', handleCallEnd);
        client.on('message', handleMessage);
        client.on('speech-start', handleSpeechStart);
        client.on('speech-end', handleSpeechEnd);
        client.on('error', handleVapiError);

        return () => {
            if (sessionIdRef.current) {
                getVapi().stop();
                endVoiceSession(sessionIdRef.current, durationRef.current).catch((err) =>
                    console.error('Failed to end voice session on unmount:', err)
                );
                sessionIdRef.current = null;
            }

            client.removeListener('call-start', handleCallStart);
            client.removeListener('call-end', handleCallEnd);
            client.removeListener('message', handleMessage);
            client.removeListener('speech-start', handleSpeechStart);
            client.removeListener('speech-end', handleSpeechEnd);
            client.removeListener('error', handleVapiError);
            
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [durationRef, finalizeSession, maxDurationRef]);

    const start = async () => {
        if (!userId) return setLimitError('Please login to start conversation.');

        setLimitError(null);
        setCallError(null);
        setIsBillingError(false);
        setStatus('connecting');
        let startedSessionId: string | null = null;

        try {
            const result = await startVoiceSession(userId, book._id);

            if (!result.success) {
                setIsBillingError(!!result.isBillingError);
                setLimitError(result.error || 'Session limit reached. Please upgrade your plan.');
                setStatus('idle');
                return;
            }

            startedSessionId = result.sessionId || null;
            sessionIdRef.current = startedSessionId;

            if (!result.webCall) throw new Error("Vapi did not return a web call.");
            await getVapi().reconnect(result.webCall);

        } catch (e) {
            console.error('Error starting call', e);
            if (startedSessionId) {
                await finalizeSession(startedSessionId, durationRef.current);
            }
            setStatus('idle');
            setCallError('Unable to start the Vapi call. Check the browser console and Vapi configuration.');
        }
    };
    
    const stop = async () => {
        isStoppingRef.current = true;
        try {
            await getVapi().stop();
        } catch (e) {
            console.error('Error stopping call', e);
        } finally {
            isStoppingRef.current = false;
        }
    };

    const clearErrors = useCallback(() => {
        setLimitError(null);
        setIsBillingError(false);
        setCallError(null);
    }, []);

    return {
        status,
        isActive,
        limitError,
        isBillingError,
        callError,
        messages,
        currentMessage,
        currentUserMessage,
        duration,
        start,
        stop,
        clearErrors,
        maxDurationSeconds,
    };
};

export default useVapi;
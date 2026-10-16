import { endVoiceSession, startVoiceSession } from "@/lib/actions/session.actions";
import { ASSISTANT_ID, DEFAULT_VOICE, VOICE_SETTINGS } from "@/lib/constants";
import { IBook, Messages } from "@/types";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useRef, useState, useEffect} from "react";
import Vapi from '@vapi-ai/web'
import { getVoice } from "@/lib/utils";

export type CallStatus = 'idle' | 'connecting' | 'starting' | 'listening' | 'thinking' | 'speaking';

type VapiTranscriptMessage = {
    role: 'assistant' | 'user';
    transcriptType: 'partial' | 'final';
    transcript: string;
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

const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY

let vapi: InstanceType<typeof Vapi>

function getVapi() {
    if(!vapi) {
        if(!VAPI_API_KEY)
            throw new Error('VAPI_API_KEY not found. Please set it in the .env file.')
        vapi = new Vapi(VAPI_API_KEY);
    }
    return vapi;
}

export const useVapi = (book: IBook) => {
    const { userId } = useAuth();

    const [status, setStatus] = useState<CallStatus>('idle');
    const [message, setMessages] = useState<Messages[]>([]);
    const [currentMessage, setCurrentMessage] = useState('')
    const [currentUserMessage, setCurrentUserMessage] = useState('')
    const [duration, setDuration] = useState(0);
    const [limitError, setLimitError] = useState<string | null>(null);
    const [callError, setCallError] = useState<string | null>(null);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const isStoppingRef = useRef<boolean>(false);
    const finalizingSessionRef = useRef<string | null>(null);
    const [isBillingError, setIsBillingError] = useState(false);

    const durationRef = useLatestRef(duration);

    const isActive = status === 'listening' || status === 'thinking' || status === 'speaking' || status === 'starting'

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
        if (!VAPI_API_KEY) return;

        const client = getVapi();
        const handleCallStart = () => {
            setStatus('listening');
            setDuration(0);
            durationRef.current = 0;
            startTimeRef.current = Date.now();
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                if (startTimeRef.current !== null) {
                    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                    setDuration(elapsed);
                    durationRef.current = elapsed;
                }
            }, 1000);
        };

        const handleSpeechStart = () => setStatus('speaking');
        const handleSpeechEnd = () => setStatus('listening');
        const handleVapiError = (error: unknown) => {
            console.error('Vapi call or audio error', error);
            setCallError('Vapi could not start or play the assistant audio. Check the browser console and audio permissions.');
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
                : Math.floor((Date.now() - startTimeRef.current) / 1000);
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
                return;
            }

            setMessages((currentMessages) => [
                ...currentMessages,
                { role: message.role, content: message.transcript },
            ]);
            setCurrentTranscript('');
        };

        client.on('call-start', handleCallStart);
        client.on('call-end', handleCallEnd);
        client.on('message', handleMessage);
        client.on('speech-start', handleSpeechStart);
        client.on('speech-end', handleSpeechEnd);
        client.on('error', handleVapiError);

        return () => {
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
    }, [durationRef, finalizeSession]);

    const start = async () => {
        if(!userId) return setLimitError('Please login to start conversation.')

        setLimitError(null);
        setCallError(null);
        setIsBillingError(false);
        setStatus('connecting');
        let startedSessionId: string | null = null;

        try {
            const result = await startVoiceSession(userId, book._id)

            if(!result.success) {
                setIsBillingError(!!result.isBillingError);
                setLimitError(result.error || 'Session limit reached. Please upgrade your plan.')
                setStatus('idle');
                return;
            }

            startedSessionId = result.sessionId || null;
            sessionIdRef.current = startedSessionId;

            const firstMessage = `Hey, good to meet you. Quick question, before we dive in: have you actually read ${book.title} yet or are we starting fresh?`
            const voice = getVoice(book.persona || DEFAULT_VOICE);

            const call = await getVapi().start(ASSISTANT_ID, {
                firstMessage,
                variableValues: {
                    title: book.title, author: book.author, bookId: book._id,
                },
                voice: {
                    provider: '11labs',
                    voiceId: voice.id,
                    model: 'eleven_turbo_v2_5',
                    stability: VOICE_SETTINGS.stability,
                    similarityBoost: VOICE_SETTINGS.similarityBoost,
                    style: VOICE_SETTINGS.style,
                    useSpeakerBoost: VOICE_SETTINGS.useSpeakerBoost,
                    speed: VOICE_SETTINGS.speed,
                },
            });
            if (!call) throw new Error('Vapi did not start a call.');

        } catch (e) {
            console.error('Error starting call', e);
            if (startedSessionId) {
                await finalizeSession(startedSessionId, durationRef.current);
            }
            setStatus('idle');
            setCallError('Unable to start the Vapi call. Check the browser console and Vapi configuration.');
        }
    }
    const stop = async () => {
        isStoppingRef.current = true;
        try {
            await getVapi().stop();
        } catch (e) {
            console.error('Error stopping call', e);
        } finally {
            isStoppingRef.current = false;
        }
    }
    const clearErrors = () => {
        setLimitError(null);
        setIsBillingError(false);
        setCallError(null);
    }

    return {
        status,
        isActive,
        limitError,
        isBillingError,
        callError,
        message,
        currentMessage,
        currentUserMessage,
        duration,
        start,
        stop,
        clearErrors,
    }
}

export default useVapi;
import { DEFAULT_VOICE } from "@/lib/constants";
import { IBook, Messages } from "@/types";
import { useAuth } from "@clerk/nextjs";
import { useRef, useState, useEffect} from "react";

export type CallStatus = 'idle' | 'connecting' | 'starting' | 'listening' | 'thinking' | 'speaking';

const useLatestRef = <T>(value: T) => {
    const ref = useRef(value);
    useEffect(() => {
        ref.current = value;
    }), [value];
    return ref;
}


export const useVapi = (book: IBook) => {
    const { userId } = useAuth();

    const [status, setStatus] = useState<CallStatus>('idle');
    const [message, setMessages] = useState<Messages[]>([]);
    const [currentMessage, setCurrentMessage] = useState('')
    const [currentUserMessage, setCurrentUserMessage] = useState('')
    const [duration, setDuration] = useState(0);
    const [limitError, setLimitError] = useState<string | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<NodeJS.Timeout | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const isStoppingRef = useRef<boolean>(false);

    const bookRef = useLatestRef(book);
    const durationRef = useLatestRef(duration);
    // const maxDurationRef = useLatestRef(resourceLimits.maxSessionMinutes * 60)
    const voice = book.persona || DEFAULT_VOICE;

    const isActive = status === 'listening' || status === 'thinking' || status === 'speaking' || status === 'starting'

    const start = async () => {
        if(!userId) return setLimitError('Please login to start conversation.')

        setLimitError(null);
        setStatus('connecting');

        try {

        } catch (e) {
            console.error('Error starting call'), e;
            setStatus('idle');
            setLimitError('An error occured while starting the call');
        }
    }
    const stop = async () => {}
    const clearErrors = async () => {}

    return {
        status,
        isActive,
        message,
        currentMessage,
        currentUserMessage,
        duration,
        start,
        stop,
        clearErrors,
        // maxDurationSeconds, remainingSeconds, showTimeWarning
    }
}

export default useVapi;
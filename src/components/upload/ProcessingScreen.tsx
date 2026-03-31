import { Loader } from 'lucide-react';

interface ProcessingScreenProps {
    progress: number;
    message: string;
}

export default function ProcessingScreen({ progress, message }: ProcessingScreenProps) {
    return (
        <div className="min-h-screen bg-prosperus-midnight flex items-center justify-center p-6">
            <div className="card max-w-sm w-full text-center">
                <Loader className="h-12 w-12 text-prosperus-gold mx-auto mb-4 animate-spin" />
                <h2 className="text-xl font-bold text-prosperus-white mb-2">Processando dados</h2>
                <p className="text-sm text-prosperus-white/60 mb-5">{message}</p>

                <div className="progress-track h-3">
                    <div
                        className="progress-fill medium h-3"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <p className="text-xs text-prosperus-white/40 mt-2">{progress}%</p>
            </div>
        </div>
    );
}

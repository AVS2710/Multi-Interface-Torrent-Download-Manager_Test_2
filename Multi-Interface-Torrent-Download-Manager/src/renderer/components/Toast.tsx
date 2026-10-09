import React, { useState, useEffect } from 'react';

const Toast: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const torrentApi = (window as unknown as { torrentApi?: { subscribeToToasts: (cb: (toast: { message: string }) => void) => void, unsubscribeFromToasts: () => void } }).torrentApi;
    if (torrentApi) {
      torrentApi.subscribeToToasts((data) => {
        setMessage(data.message);
        setTimeout(() => setMessage(null), 3000);
      });
      return () => torrentApi.unsubscribeFromToasts();
    }
  }, []);

  if (!message) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded shadow-lg">
      {message}
    </div>
  );
};

export default Toast;

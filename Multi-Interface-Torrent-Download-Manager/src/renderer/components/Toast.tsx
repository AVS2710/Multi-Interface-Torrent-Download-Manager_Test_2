import React, { useEffect, useState } from 'react';

const Toast: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const api = window.torrentApi;
    if (!api) return;

    api.subscribeToToasts(toast => {
      setMessage(toast.message);
      window.setTimeout(() => setMessage(null), 3500);
    });
    return () => api.unsubscribeFromToasts();
  }, []);

  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[60] bg-gray-800 text-white p-4 rounded shadow-lg max-w-md">
      {message}
    </div>
  );
};

export default Toast;

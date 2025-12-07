import React from 'react';

const Loader = ({ text = 'Generating...' }: { text?: string }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-lg font-semibold text-text-light-mode dark:text-text-dark-mode">{text}</p>
    </div>
  );
};

export default Loader;
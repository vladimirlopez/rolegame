import React from 'react';
import '../styles/global.css';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundImage: 'radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0d0d12 100%)',
        }}>
            <main style={{ flex: 1, padding: '2rem', overflow: 'hidden', position: 'relative' }}>
                {children}
            </main>
        </div>
    );
};

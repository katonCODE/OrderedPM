import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('App smoke test', () => {
  it('renders landing page content', async () => {
    render(<App />);

    expect(await screen.findByText(/Get Started/i)).toBeInTheDocument();
  });
});

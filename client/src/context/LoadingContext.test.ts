import { describe, expect, it } from 'vitest';
import { createElement, useContext } from 'react';
import { render } from '@testing-library/react';
import { LoadingContext } from './LoadingContext';

describe('LoadingContext', () => {
  it('default context value is false', () => {
    let captured: boolean | undefined;
    function Probe(): null {
      captured = useContext(LoadingContext);
      return null;
    }
    render(createElement(Probe));
    expect(captured).toBe(false);
  });
});

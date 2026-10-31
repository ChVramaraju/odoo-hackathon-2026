import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Modal } from './Modal';

describe('Modal Component', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('renders children and backdrop when isOpen is true', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Modal Content Here</div>
      </Modal>
    );

    expect(screen.getByText('Modal Content Here')).toBeInTheDocument();
    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument();
    expect(screen.getByTestId('modal-content')).toBeInTheDocument();
  });

  it('does not render anything when isOpen is false', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={false} onClose={handleClose}>
        <div>Hidden Modal Content</div>
      </Modal>
    );

    expect(screen.queryByText('Hidden Modal Content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
  });

  it('calls onClose when clicking on the backdrop (outside modal content)', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Inside Content</div>
      </Modal>
    );

    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when clicking inside the modal content', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <button type="button">Inside Button</button>
      </Modal>
    );

    const button = screen.getByRole('button', { name: 'Inside Button' });
    fireEvent.click(button);

    expect(handleClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Modal with Escape listener</div>
      </Modal>
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('locks document.body scrolling while open and restores it when closed', () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Scroll Lock Test</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal isOpen={false} onClose={handleClose}>
        <div>Scroll Lock Test</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('');
  });

  it('properly maintains body scroll lock when multiple modals are opened and closed', () => {
    const handleClose1 = vi.fn();
    const handleClose2 = vi.fn();

    const { rerender } = render(
      <>
        <Modal isOpen={true} onClose={handleClose1}>
          <div>First Modal</div>
        </Modal>
        <Modal isOpen={true} onClose={handleClose2}>
          <div>Second Nested Modal</div>
        </Modal>
      </>
    );

    expect(document.body.style.overflow).toBe('hidden');

    // Close the second modal
    rerender(
      <>
        <Modal isOpen={true} onClose={handleClose1}>
          <div>First Modal</div>
        </Modal>
        <Modal isOpen={false} onClose={handleClose2}>
          <div>Second Nested Modal</div>
        </Modal>
      </>
    );

    // Body should STILL be locked because first modal is open
    expect(document.body.style.overflow).toBe('hidden');

    // Close the first modal
    rerender(
      <>
        <Modal isOpen={false} onClose={handleClose1}>
          <div>First Modal</div>
        </Modal>
        <Modal isOpen={false} onClose={handleClose2}>
          <div>Second Nested Modal</div>
        </Modal>
      </>
    );

    // Body scroll should now be restored
    expect(document.body.style.overflow).toBe('');
  });
});


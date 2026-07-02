package crypto

import "testing"

func TestSecretBoxEncryptDecryptAndMask(t *testing.T) {
	box := NewSecretBox("test-secret")
	sealed, err := box.Encrypt("sk-test-1234567890")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if sealed == "sk-test-1234567890" {
		t.Fatal("ciphertext leaked plaintext")
	}
	plain, err := box.Decrypt(sealed)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if plain != "sk-test-1234567890" {
		t.Fatalf("unexpected plaintext %q", plain)
	}
	if got := MaskSecret(plain); got != "sk-t...7890" {
		t.Fatalf("unexpected mask %q", got)
	}
}

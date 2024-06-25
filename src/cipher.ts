import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';

// Encrypt function
export function encrypt(text: string, key: string): string {
    // Hash the key to create a salt
    const salt = scryptSync(key, 'salt', 32);

    // Generate a random initialization vector
    const iv = randomBytes(16);

    // Create a cipher using the salt and initialization vector
    const cipher = createCipheriv('aes-256-gcm', salt, iv);

    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get the authentication tag generated during encryption
    const authTag = cipher.getAuthTag().toString('hex');

    // Return the concatenation of the IV, auth tag, and encrypted text
    return iv.toString('hex') + authTag + encrypted;
}

// Decrypt function
export function decrypt(encryptedText: string, key: string): string {
    // Hash the key to recreate the salt
    const salt = scryptSync(key, 'salt', 32);

    // Extract the IV, auth tag, and encrypted text from the input
    const iv = Buffer.from(encryptedText.slice(0, 32), 'hex');
    const authTag = Buffer.from(encryptedText.slice(32, 64), 'hex');
    const encrypted = encryptedText.slice(64);

    // Create a decipher using the salt and initialization vector
    const decipher = createDecipheriv('aes-256-gcm', salt, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

//Hash group ID function
export function hashGroupID(groupID: string): string {
    return createHash('sha256').update(groupID).digest('hex');
}

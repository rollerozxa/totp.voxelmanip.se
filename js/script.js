
function base32ToHex(base32) {
	const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	let bits = "";
	let hex = "";
	base32 = base32.replace(/\s+/g, '');

	for (let i = 0; i < base32.length; i++) {
		const val = base32Chars.indexOf(base32.charAt(i).toUpperCase());
		bits += val.toString(2).padStart(5, "0");
	}

	for (let i = 0; i + 4 <= bits.length; i += 4) {
		const chunk = bits.substring(i, i + 4);
		hex += parseInt(chunk, 2).toString(16);
	}

	console.log(hex);

	return hex;
}

async function generateTOTP(secretKey, time) {
	const key = base32ToHex(secretKey);

	// Ensure the hex string has an even length by padding with a leading zero if necessary
	const paddedKey = key.length % 2 !== 0 ? '0' + key : key;

	const hmacKey = Uint8Array.from(paddedKey.match(/.{2}/g).map(byte => parseInt(byte, 16)));
	const timeHex = time.toString(16).padStart(16, "0");
	const timeBytes = Uint8Array.from(timeHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));

	const cryptoKey = await crypto.subtle.importKey("raw", hmacKey, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
	const hmac = await crypto.subtle.sign("HMAC", cryptoKey, timeBytes);

	const offset = new Uint8Array(hmac)[19] & 0xf;
	const binary = (new DataView(hmac).getUint32(offset) & 0x7fffffff) % 1000000;

	return binary.toString().padStart(6, "0");
}

let activeIntervals = [];

async function generateTOTPCodes() {
	const secretKey = document.getElementById("keyInput").value.trim();
	if (!secretKey) {
		const totpCodesContainer = document.getElementById("totp-codes");

		activeIntervals.forEach(interval => clearInterval(interval));
		activeIntervals = [];
		totpCodesContainer.innerHTML = "";
		totpCodesContainer.style.display = "none";
		return;
	}

	const totpCodesContainer = document.getElementById("totp-codes");
	totpCodesContainer.style.display = "block";

	activeIntervals.forEach(interval => clearInterval(interval));
	activeIntervals = [];

	const codes = [];
	const currentInterval = Math.floor(Date.now() / 1000 / 30);

	for (let i = 0; i < 5; i++) {
		const interval = currentInterval + i;
		const code = await generateTOTP(secretKey, interval);
		const timeRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
		codes.push({ code, expiresIn: timeRemaining + 30 * i });
	}

	totpCodesContainer.innerHTML = "";

	codes.forEach((codeObj, index) => {
		const codeElement = document.createElement("div");
		codeElement.className = "code";
		codeElement.innerHTML = `
			<span>${codeObj.code}</span>
			<span id="timer${index}">${codeObj.expiresIn}s</span>
		`;
		totpCodesContainer.appendChild(codeElement);

		// Update countdown timer
		const timerInterval = setInterval(() => {
			codeObj.expiresIn--;
			document.getElementById(`timer${index}`).textContent = `${codeObj.expiresIn}s`;

			// Clear timer when expired
			if (codeObj.expiresIn <= 0) {
				clearInterval(timerInterval);
				document.getElementById(`timer${index}`).textContent = "Expired";
			}
		}, 1000);

		activeIntervals.push(timerInterval);
	});
}

document.getElementById("keyInput").addEventListener("input", generateTOTPCodes);

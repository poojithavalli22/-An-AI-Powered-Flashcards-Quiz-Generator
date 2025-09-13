function submitContact() {
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const message = document.getElementById('message').value.trim();
        if (!name || !email || !message) { alert('Please complete all fields.'); return; }
        alert('Thanks for reaching out! Your message has been noted locally.');
    }
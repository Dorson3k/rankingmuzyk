const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const gameScreen = document.getElementById('game-screen');
const duelScreen = document.getElementById('duel-screen');
const usernameInput = document.getElementById('username');
const registerBtn = document.getElementById('register-btn');
const loginBtn = document.getElementById('login-btn');
const soloBtn = document.getElementById('solo-btn');
const duelBtn = document.getElementById('duel-btn');
const downloadAccBtn = document.getElementById('download-acc-btn');
const userDisplay = document.getElementById('user-display');
const eloDisplay = document.getElementById('elo-display');
const matchesDisplay = document.getElementById('matches-display');
const songPlayer = document.getElementById('song-player');
const optionsDiv = document.getElementById('options');
const nextBtn = document.getElementById('next-btn');
const resultDiv = document.getElementById('result');
const gameMode = document.getElementById('game-mode');
const sessionIdDisplay = document.getElementById('session-id');
const opponentSessionInput = document.getElementById('opponent-session');
const connectDuelBtn = document.getElementById('connect-duel-btn');

let currentUser = null;
let peer = null;
let conn = null;
let currentSong = null;
let currentMode = null;
let opponentScore = 0;

// Zarządzanie kontami
function saveAccount(username, elo = 1000, matches = 0) {
    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    accounts[username] = { username, elo, matches };
    localStorage.setItem('accounts', JSON.stringify(accounts));
}

function loadAccount(username) {
    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    return accounts[username];
}

function downloadAccountData() {
    const data = JSON.stringify(loadAccount(currentUser.username));
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'acc.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Formuła ELO
function updateELO(winner, loser) {
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
    winner.elo += Math.round(K * (1 - expectedScore));
    loser.elo += Math.round(K * (0 - expectedScore));
    winner.matches++;
    loser.matches++;
    saveAccount(winner.username, winner.elo, winner.matches);
    saveAccount(loser.username, loser.elo, loser.matches);
}

// Logika gry
function getRandomSong() {
    return songs[Math.floor(Math.random() * songs.length)];
}

function getRandomOptions(correctSong) {
    const options = [correctSong];
    while (options.length < 4) {
        const randomSong = getRandomSong();
        if (!options.includes(randomSong)) options.push(randomSong);
    }
    return options.sort(() => Math.random() - 0.5);
}

function startGame(mode) {
    currentMode = mode;
    gameMode.textContent = mode === 'solo' ? 'Tryb Solo' : 'Tryb Duel';
    mainScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    nextRound();
}

function nextRound() {
    currentSong = getRandomSong();
    songPlayer.src = currentSong.src;
    songPlayer.currentTime = 0;
    songPlayer.play();
    setTimeout(() => songPlayer.pause(), 5000);

    optionsDiv.innerHTML = '';
    const options = getRandomOptions(currentSong);
    options.forEach(song => {
        const btn = document.createElement('button');
        btn.className = 'option-btn bg-blue-500 hover:bg-blue-600 p-3 rounded w-48';
        btn.textContent = `${song.title} - ${song.artist}`;
        btn.onclick = () => checkAnswer(song);
        optionsDiv.appendChild(btn);
    });
    resultDiv.textContent = '';
    nextBtn.classList.add('hidden');
}

function checkAnswer(selectedSong) {
    const isCorrect = selectedSong === currentSong;
    resultDiv.textContent = isCorrect ? 'Poprawnie!' : 'Błąd!';
    songPlayer.pause();
    optionsDiv.querySelectorAll('button').forEach(btn => btn.disabled = true);
    nextBtn.classList.remove('hidden');

    if (currentMode === 'solo') {
        if (isCorrect) {
            currentUser.elo += 10;
        } else {
            currentUser.elo = Math.max(0, currentUser.elo - 10);
        }
        currentUser.matches++;
        saveAccount(currentUser.username, currentUser.elo, currentUser.matches);
        updateUserDisplay();
    } else if (currentMode === 'duel' && conn) {
        conn.send({ type: 'answer', isCorrect });
    }
}

// WebRTC dla trybu Duel
function startDuel() {
    mainScreen.classList.add('hidden');
    duelScreen.classList.remove('hidden');
    peer = new Peer();
    peer.on('open', id => {
        sessionIdDisplay.textContent = id;
    });
    peer.on('connection', connection => {
        conn = connection;
        conn.on('data', handleDuelData);
        startGame('duel');
    });
}

function connectToDuel() {
    const opponentId = opponentSessionInput.value;
    if (!opponentId) return;
    conn = peer.connect(opponentId);
    conn.on('open', () => {
        conn.on('data', handleDuelData);
        startGame('duel');
    });
}

function handleDuelData(data) {
    if (data.type === 'answer') {
        opponentScore = data.isCorrect ? 1 : 0;
        const userScore = resultDiv.textContent === 'Poprawnie!' ? 1 : 0;
        if (userScore > opponentScore) {
            updateELO(currentUser, { username: 'opponent', elo: 1000, matches: 0 });
            resultDiv.textContent += ' Wygrałeś!';
        } else if (userScore < opponentScore) {
            updateELO({ username: 'opponent', elo: 1000, matches: 0 }, currentUser);
            resultDiv.textContent += ' Przegrałeś!';
        } else {
            resultDiv.textContent += ' Remis!';
        }
        updateUserDisplay();
    }
}

// Interfejs użytkownika
function updateUserDisplay() {
    userDisplay.textContent = currentUser.username;
    eloDisplay.textContent = currentUser.elo;
    matchesDisplay.textContent = currentUser.matches;
}

registerBtn.onclick = () => {
    const username = usernameInput.value.trim();
    if (username && !loadAccount(username)) {
        saveAccount(username);
        currentUser = loadAccount(username);
        authScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        updateUserDisplay();
    } else {
        alert('Nazwa zajęta lub nieprawidłowa!');
    }
};

loginBtn.onclick = () => {
    const username = usernameInput.value.trim();
    const account = loadAccount(username);
    if (account) {
        currentUser = account;
        authScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        updateUserDisplay();
    } else {
        alert('Konto nie istnieje!');
    }
};

soloBtn.onclick = () => startGame('solo');
duelBtn.onclick = startDuel;
connectDuelBtn.onclick = connectToDuel;
nextBtn.onclick = nextRound;
downloadAccBtn.onclick = downloadAccountData;

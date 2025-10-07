const webAppUrl = "https://script.google.com/macros/s/AKfycbwcGEV0ZcMt9iB5TjcynwZOg80fz2GibC-2mHSClXl7GvIZ3VuGJNGjvvTCa8czhNGJeA/exec";

// Variables globales
let ticketUnitValue = 8;
let isMenuStandard = false;
let currentMenuPrice = 0;
let currentMenuCost = 0;
let allData = {};
let selectedClient = "";
let currentUser = null;
let currentPassword = "";
let isHomePageVisible = true;

// =============================
// Vérifie si l'utilisateur est resté connecté
// =============================
function isUserLoggedIn() {
  return localStorage.getItem("stayConnected") === "true" &&
         localStorage.getItem("username") !== null &&
         localStorage.getItem("password") !== null;
}

// Fonction pour vérifier si l'utilisateur peut ajouter des employés
function canAddEmploye() {
  return currentUser && (currentUser.role === 'admin' || currentUser.role === 'patron');
}

// Fonction pour mettre à jour l'affichage du bouton "Ajouter un employé"
function updateAddEmployeButtonVisibility() {
  const addEmployeButton = document.getElementById('addEmployeButton');
  if (addEmployeButton) {
    addEmployeButton.style.display = canAddEmploye() ? 'block' : 'none';
  }
}

// =============================
// Connexion automatique depuis le localStorage
// =============================
async function autoLoginFromStorage() {
  const savedUsername = localStorage.getItem("username");
  const savedPassword = localStorage.getItem("password");
  if (!savedUsername || !savedPassword) return false;
  const result = await fetchData("verifyUser", { username: savedUsername, password: savedPassword });
  if (result?.success) {
    currentUser = {
      username: savedUsername,
      role: result.role || "employe",
      employe: result.employe || savedUsername
    };
    currentPassword = savedPassword;
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('welcomeUsername').textContent = currentUser.username;
    document.getElementById('employe').value = result.employe || savedUsername;
    await loadAllData();
    updateAddEmployeButtonVisibility();
    return true;
  }
  return false;
}

// Affiche un message de statut
function setStatus(message, isError = false, elementId = 'status') {
  const statusElement = document.getElementById(elementId);
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = isError ? 'status error' : 'status';
  }
}

// Requête vers l'API
async function fetchData(action, params = {}, method = "GET", data = null) {
  try {
    let url = `${webAppUrl}?action=${action}`;
    for (const [key, value] of Object.entries(params)) {
      url += `&${key}=${encodeURIComponent(value)}`;
    }
    const options = { method };
    if (data) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(data);
    }
    const response = await fetch(url, options);
    if (method === "POST") {
      return { success: true };
    }
    try {
      return await response.json();
    } catch (e) {
      const text = await response.text();
      if (text.includes("API fonctionnelle")) {
        return { success: false, error: "Action non reconnue" };
      }
      return { success: false, error: text || "Réponse invalide" };
    }
  } catch (error) {
    console.error(`Erreur (${action}):`, error);
    return { success: false, error: error.message };
  }
}

// Connexion de l'utilisateur
async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  if (!username || !password) {
    setStatus("Veuillez remplir tous les champs.", true, 'loginError');
    return false;
  }
  if (rememberMe) {
    localStorage.setItem('rememberedUsername', username);
    localStorage.setItem('rememberMe', 'true');
  } else {
    localStorage.removeItem('rememberedUsername');
    localStorage.removeItem('rememberMe');
  }
  currentPassword = password;
  const result = await fetchData("verifyUser", { username, password });
  if (result?.success) {
    currentUser = {
      username,
      role: result.role || "employe",
      employe: result.employe || username
    };
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('welcomeUsername').textContent = currentUser.username;
    document.getElementById('employe').value = result.employe || username;
    await loadAllData();
    updateAddEmployeButtonVisibility();
    const stayConnectedChecked = document.getElementById("stayConnected")?.checked;
    if (stayConnectedChecked) {
      localStorage.setItem("username", username);
      localStorage.setItem("password", password);
      localStorage.setItem("stayConnected", "true");
    } else {
      localStorage.removeItem("username");
      localStorage.removeItem("password");
      localStorage.setItem("stayConnected", "false");
    }
    return true;
  } else {
    setStatus(result?.error || "Identifiants incorrects.", true, 'loginError');
    return false;
  }
}

// Déconnexion
function logout() {
  currentUser = null;
  currentPassword = "";
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('homePage').style.display = 'none';
  document.getElementById('loginForm').style.display = 'flex';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('stayConnected').checked = false;
  localStorage.removeItem("username");
  localStorage.removeItem("password");
  localStorage.setItem("stayConnected", "false");
  updateAddEmployeButtonVisibility();
}

// Calcule le numéro de la semaine
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Met à jour la date et la semaine
function updateDateInfo() {
  const today = new Date();
  const jours = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  document.getElementById('dateJour').value = today.toLocaleDateString('fr-FR');
  document.getElementById('jourLettre').value = jours[today.getDay()];
  document.getElementById('numSemaine').value = getWeekNumber(today);
}

// Met à jour la quantité si un produit est désélectionné
function updateQuantityIfEmpty(selectElement) {
  const position = selectElement.dataset.position;
  const quantityInput = document.querySelector(`.product-quantity[data-position="${position}"]`);
  if (selectElement.value === "") {
    quantityInput.value = 0;
    calculerTotaux();
  }
}

// Synchronise les quantités
function syncQuantities() {
  const platQuantityInput = document.querySelector('.product-quantity[data-position="1"]');
  const quantity = parseInt(platQuantityInput.value) || 0;
  document.querySelectorAll('.product-quantity[data-position="2"], .product-quantity[data-position="3"]').forEach(input => {
    const selectElement = document.querySelector(`.product-select[data-position="${input.dataset.position}"]`);
    if (selectElement.value !== "") {
      input.value = quantity;
    } else {
      input.value = 0;
    }
  });
  const boissonSelect = document.querySelector('.product-select[data-position="4"]');
  const boissonQuantityInput = document.querySelector('.product-quantity[data-position="4"]');
  if (boissonSelect.disabled || boissonSelect.value === "") {
    boissonQuantityInput.value = 0;
  } else {
    boissonQuantityInput.value = quantity;
  }
  const optionnelSelect = document.querySelector('.product-select[data-position="5"]');
  const optionnelQuantityInput = document.querySelector('.product-quantity[data-position="5"]');
  if (optionnelSelect.value === "") {
    optionnelQuantityInput.value = 0;
  } else {
    optionnelQuantityInput.value = quantity;
  }
  calculerTotaux();
}

// Remplit une liste déroulante
function fillSelect(selectElement, options, valueKey = null, textKey = null, dataAttributes = {}) {
  const defaultOption = selectElement.querySelector('option[value=""]');
  selectElement.innerHTML = '';
  if (defaultOption) {
    selectElement.appendChild(defaultOption);
  } else {
    const option = document.createElement('option');
    option.value = "";
    option.textContent = "-";
    selectElement.appendChild(option);
  }
  if (selectElement.id === "noms_des_client") {
    const nouveauOption = document.createElement('option');
    nouveauOption.value = "nouveau";
    nouveauOption.textContent = "+ Nouveau client...";
    selectElement.appendChild(nouveauOption);
  }
  options.forEach(option => {
    const optElement = document.createElement('option');
    optElement.value = valueKey ? option[valueKey] : option;
    optElement.textContent = textKey ? option[textKey] : option;
    for (const [attr, key] of Object.entries(dataAttributes)) {
      if (option[key] !== undefined) optElement.dataset[attr] = option[key];
    }
    selectElement.appendChild(optElement);
  });
}

// Charge toutes les données
async function loadAllData() {
  const result = await fetchData("getAllData");
  allData = result;
  fillSelect(document.getElementById('contrat_entreprise'), allData.contrats);
  fillSelect(document.getElementById('noms_des_client'), allData.clients);
  const menuSelect = document.getElementById('menu');
  menuSelect.innerHTML = '<option value="sans menu">sans menu</option>';
  allData.menus.forEach(menu => {
    const option = document.createElement('option');
    option.value = menu;
    option.textContent = menu;
    menuSelect.appendChild(option);
  });
  document.querySelectorAll('.product-select').forEach(select => {
    fillSelect(select, allData.allProducts, 'name', 'name', { price: 'price', cost: 'cost', type: 'type' });
  });
  ticketUnitValue = allData.ticketValue || 8;
}

// Active le mode libre
function unlockProductSelections() {
  isMenuStandard = false;
  currentMenuPrice = 0;
  currentMenuCost = 0;
  document.querySelectorAll('.product-select').forEach(select => {
    select.disabled = false;
    select.value = "";
  });
  document.querySelectorAll('.product-quantity').forEach(input => {
    input.value = 0;
  });
  document.querySelectorAll('.product-select').forEach(select => {
    fillSelect(select, allData.allProducts, 'name', 'name', { price: 'price', cost: 'cost', type: 'type' });
  });
  setStatus("Mode libre : sélectionnez vos produits.");
}

// Charge les produits d'un menu
async function loadMenuProducts(menuName) {
  setStatus(`Chargement du menu "${menuName}"...`);
  const menuDetails = allData.menusWithDetails.find(m => m.name === menuName);
  if (!menuDetails) {
    setStatus(`Menu "${menuName}" non trouvé.`, true);
    return;
  }
  currentMenuPrice = menuDetails.price;
  currentMenuCost = menuDetails.cost;
  isMenuStandard = true;
  document.querySelectorAll('.product-select[data-position="1"], .product-select[data-position="2"], .product-select[data-position="3"]').forEach(select => {
    select.disabled = true;
  });
  const boissonSelect = document.querySelector('.product-select[data-position="4"]');
  if (menuName.includes("S-B")) {
    boissonSelect.disabled = true;
    boissonSelect.value = "";
  } else {
    boissonSelect.disabled = false;
    fillSelect(boissonSelect, allData.boissons, 'name', 'name', { price: 'price', cost: 'cost', type: 'type' });
  }
  document.querySelector('.product-select[data-position="1"]').value = menuDetails.plat || "";
  document.querySelector('.product-select[data-position="2"]').value = menuDetails.accompagnement || "";
  document.querySelector('.product-select[data-position="3"]').value = menuDetails.dessert || "";
  document.querySelector('.product-select[data-position="4"]').value = menuDetails.boisson || "";
  document.querySelector('.product-select[data-position="5"]').value = "";
  document.querySelector('.product-quantity[data-position="1"]').value = 0;
  syncQuantities();
  setStatus(`Menu "${menuName}" chargé.`);
}

// Gère la sélection d'un menu
async function handleMenuSelection() {
  const menuSelect = document.getElementById('menu');
  const selectedMenu = menuSelect.value;
  if (selectedMenu === "sans menu") {
    unlockProductSelections();
  } else {
    await loadMenuProducts(selectedMenu);
  }
  calculerTotaux();
}

// Calcule les totaux
function calculerTotaux() {
  let coutGlobal = 0, prixGlobal = 0;
  if (isMenuStandard) {
    const quantity = parseInt(document.querySelector('.product-quantity[data-position="1"]').value) || 1;
    prixGlobal = currentMenuPrice * quantity;
    coutGlobal = currentMenuCost * quantity;
  } else {
    document.querySelectorAll('.product-select').forEach(select => {
      const position = select.dataset.position;
      const input = document.querySelector(`.product-quantity[data-position="${position}"]`);
      const option = select.options[select.selectedIndex];
      const quantite = parseInt(input.value) || 0;
      const price = parseFloat(option.dataset.price) || 0;
      const cost = parseFloat(option.dataset.cost) || 0;
      if (select.value !== "") {
        coutGlobal += cost * quantite;
        prixGlobal += price * quantite;
      }
    });
  }
  const useTicket = document.getElementById('ticket').checked;
  const ticketNombre = useTicket ? parseInt(document.getElementById('ticketNombre').value) || 0 : 0;
  const ticketMontant = useTicket ? ticketNombre * ticketUnitValue : 0;
  const prixFinal = Math.max(0, prixGlobal - ticketMontant);
  const benefice = (prixFinal - coutGlobal) + ticketMontant;
  document.getElementById('coutGlobalMatierePremiere').value = `${coutGlobal.toFixed(2)} €`;
  document.getElementById('PrixAFairePayer').value = `${prixFinal.toFixed(2)} €`;
  document.getElementById('benefice').value = `${benefice.toFixed(2)} €`;
}

// Ajoute un nouveau client
async function ajouterNouveauClient() {
  const nouveauClientInput = document.getElementById('nouveauClientInput');
  const nouveauClient = nouveauClientInput.value.trim();
  if (!nouveauClient) {
    setStatus("Veuillez entrer un nom de client.", true);
    return;
  }
  setStatus(`Ajout du client "${nouveauClient}"...`);
  try {
    await fetch(webAppUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ajouterClient",
        nomClient: nouveauClient
      })
    });
    await loadAllData();
    document.getElementById('noms_des_client').value = nouveauClient;
    selectedClient = nouveauClient;
    document.getElementById('nouveauClientContainer').style.display = 'none';
    setStatus(`Client "${nouveauClient}" ajouté avec succès !`);
  } catch (error) {
    setStatus(`Erreur lors de l'ajout du client: ${error.message}`, true);
  }
}

// Charge les rôles depuis Google Sheets
async function chargerRoles() {
  try {
    const result = await fetchData("getRoles");
    if (result && result.length > 0) {
      const selectRole = document.getElementById('employeRole');
      selectRole.innerHTML = '<option value="">-- Sélectionnez un rôle --</option>';
      result.forEach(role => {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role;
        selectRole.appendChild(option);
      });
    } else {
      setStatus("Aucun rôle disponible.", true, 'addEmployeError');
    }
  } catch (error) {
    setStatus(`Erreur lors du chargement des rôles : ${error.message}`, true, 'addEmployeError');
  }
}

async function ajouterEmploye() {
  const username = document.getElementById('employeUsername').value.trim();
  const password = document.getElementById('employePassword').value;
  const nom = document.getElementById('employeNom').value.trim();
  const role = document.getElementById('employeRole').value;
  if (!username || !password || !nom || !role) {
    setStatus("Tous les champs sont obligatoires.", true, 'addEmployeError');
    return;
  }
  if (username.length < 3) {
    setStatus("L'identifiant doit faire au moins 3 caractères.", true, 'addEmployeError');
    return;
  }
  if (password.length < 6) {
    setStatus("Le mot de passe doit faire au moins 6 caractères.", true, 'addEmployeError');
    return;
  }
  try {
    const response = await fetch(webAppUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addUser",
        username: username,
        password: password,
        employe: nom,
        role: role
      })
    });
    setStatus("Employé ajouté avec succès !", false, 'addEmployeError');
    setTimeout(() => {
      document.getElementById('addEmployePage').style.display = 'none';
      document.getElementById('homePage').style.display = 'block';
      updateAddEmployeButtonVisibility();
    }, 1500);
  } catch (error) {
    setStatus(`Erreur : ${error.message}`, true, 'addEmployeError');
  }
}

// Enregistrer une commande dans Google Sheets
async function enregistrerCommande() {
  const dateJour = document.getElementById('dateJour').value;
  const jourLettre = document.getElementById('jourLettre').value;
  const numSemaine = document.getElementById('numSemaine').value;
  const employe = document.getElementById('employe').value;
  const contratEntreprise = document.getElementById('contrat_entreprise').value;
  const client = document.getElementById('noms_des_client').value;
  const menu = document.getElementById('menu').value;

  const platSelect = document.querySelector('.product-select[data-type="plat"][data-position="1"]');
  const platQuantite = document.querySelector('.product-quantity[data-type="plat"][data-position="1"]').value;
  const accompagnementSelect = document.querySelector('.product-select[data-type="accompagnement"][data-position="2"]');
  const accompagnementQuantite = document.querySelector('.product-quantity[data-type="accompagnement"][data-position="2"]').value;
  const dessertSelect = document.querySelector('.product-select[data-type="dessert"][data-position="3"]');
  const dessertQuantite = document.querySelector('.product-quantity[data-type="dessert"][data-position="3"]').value;
  const boissonSelect = document.querySelector('.product-select[data-type="boisson"][data-position="4"]');
  const boissonQuantite = document.querySelector('.product-quantity[data-type="boisson"][data-position="4"]').value;
  const optionnelSelect = document.querySelector('.product-select[data-type="optionnel"][data-position="5"]');
  const optionnelQuantite = document.querySelector('.product-quantity[data-type="optionnel"][data-position="5"]').value;

  const useTicket = document.getElementById('ticket').checked;
  const ticketNombre = document.getElementById('ticketNombre').value;

  // Dans la fonction enregistrerCommande() de ton script.js
const coutGlobal = parseInt(document.getElementById('coutGlobalMatierePremiere').value.replace(' €', ''));
const prixFinal = parseInt(document.getElementById('PrixAFairePayer').value.replace(' €', ''));
const benefice = parseInt(document.getElementById('benefice').value.replace(' €', ''));




  const rowData = [
    dateJour,                     // Colonne A
    jourLettre,                   // Colonne B
    numSemaine,                   // Colonne C
    employe,                      // Colonne D
    contratEntreprise,            // Colonne E
    client,                       // Colonne F
    menu,                         // Colonne G
    platSelect.value,             // Colonne H
    platQuantite,                 // Colonne I
    accompagnementSelect.value,   // Colonne J
    accompagnementQuantite,       // Colonne K
    dessertSelect.value,          // Colonne L
    dessertQuantite,              // Colonne M
    boissonSelect.value,          // Colonne N
    boissonQuantite,              // Colonne O
    optionnelSelect.value,        // Colonne P
    optionnelQuantite,            // Colonne Q
    useTicket ? "OUI" : "NON",     // Colonne R
    ticketNombre,                 // Colonne S
    coutGlobal,                   // Colonne T
    prixFinal,                    // Colonne U
    benefice                      // Colonne V
  ];

  try {
    setStatus("Enregistrement de la commande en cours...", false);
    const response = await fetch(webAppUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enregistrerCommandeLigne",
        data: rowData
      })
    });
    setStatus("Commande enregistrée avec succès !", false);
    setTimeout(() => {
      document.getElementById('menu').value = "sans menu";
      unlockProductSelections();
      document.querySelectorAll('.product-select').forEach(select => {
        select.value = "";
      });
      document.querySelectorAll('.product-quantity').forEach(input => {
        input.value = 0;
      });
      document.getElementById('ticket').checked = false;
      document.getElementById('ticketNombre').value = 0;
      document.getElementById('ticketNombre').disabled = true;
      calculerTotaux();
    }, 1500);
  } catch (error) {
    setStatus(`Erreur lors de l'enregistrement : ${error.message}`, true);
    console.error("Erreur:", error);
  }
}

// Initialisation et écouteurs d'événements
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('homePage').style.display = 'none';

  if (isUserLoggedIn()) {
    const loggedIn = await autoLoginFromStorage();
    if (loggedIn) {
      updateAddEmployeButtonVisibility();
    }
  }

  const rememberedUsername = localStorage.getItem('rememberedUsername');
  const rememberMeChecked = localStorage.getItem('rememberMe') === 'true';
  if (rememberedUsername && rememberMeChecked) {
    document.getElementById('loginUsername').value = rememberedUsername;
    document.getElementById('rememberMe').checked = true;
  }

  const stayConnectedChecked = localStorage.getItem("stayConnected") === "true";
  if (stayConnectedChecked) {
    document.getElementById('stayConnected').checked = true;
  }

  document.getElementById('loginButton').addEventListener('click', login);
  document.getElementById('logoutHomeButton').addEventListener('click', () => {
    logout();
    updateAddEmployeButtonVisibility();
  });

  document.getElementById('menu').addEventListener('change', handleMenuSelection);
  document.querySelectorAll('.product-select').forEach(select => {
    select.addEventListener('change', () => {
      updateQuantityIfEmpty(select);
      if (select.dataset.position === "1") syncQuantities();
      else calculerTotaux();
    });
  });
  document.querySelectorAll('.product-quantity').forEach(input => {
    input.addEventListener('input', () => {
      if (input.dataset.position === "1") syncQuantities();
      else calculerTotaux();
    });
  });
  document.getElementById('ticket').addEventListener('change', function() {
    document.getElementById('ticketNombre').disabled = !this.checked;
    document.getElementById('ticketNombre').value = this.checked ? 1 : 0;
    calculerTotaux();
  });
  document.getElementById('ticketNombre').addEventListener('input', calculerTotaux);
  document.getElementById('noms_des_client').addEventListener('change', function() {
    if (this.value === "nouveau") {
      document.getElementById('nouveauClientContainer').style.display = 'block';
      document.getElementById('nouveauClientInput').focus();
    } else {
      document.getElementById('nouveauClientContainer').style.display = 'none';
      selectedClient = this.value;
    }
  });

  document.getElementById('goToOrderButton').addEventListener('click', () => {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    updateDateInfo();
  });

  document.getElementById('editProfileButton').addEventListener('click', () => {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('editProfilePage').style.display = 'block';
    document.getElementById('newUsername').value = currentUser.username;
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    setStatus('', false, 'editProfileError');
    fetchData("getUserDetails", { username: currentUser.username })
      .then(userDetails => {
        if (userDetails.success) {
          document.getElementById('secretQuestion').value = userDetails.secret_question || "";
          document.getElementById('n°phone').value = userDetails.phone_number || "";
          document.getElementById('Iban').value = userDetails.iban || "";
        }
      });
  });

  document.getElementById('addEmployeButton').addEventListener('click', () => {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('addEmployePage').style.display = 'block';
    document.getElementById('employeUsername').value = '';
    document.getElementById('employePassword').value = '';
    document.getElementById('employeNom').value = '';
    document.getElementById('employeRole').innerHTML = '<option value="">-- Sélectionnez un rôle --</option>';
    chargerRoles();
    setStatus('', false, 'addEmployeError');
  });

  document.getElementById('backToHomeButton').addEventListener('click', () => {
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('homePage').style.display = 'block';
  });

  document.getElementById('backToHomeButton2').addEventListener('click', () => {
    document.getElementById('editProfilePage').style.display = 'none';
    document.getElementById('homePage').style.display = 'block';
  });

  document.getElementById('backToHomeButton3').addEventListener('click', () => {
    document.getElementById('addEmployePage').style.display = 'none';
    document.getElementById('homePage').style.display = 'block';
  });

  const cancelEditProfileButton = document.getElementById('cancelEditProfileButton');
  const confirmEditProfileButton = document.getElementById('confirmEditProfileButton');
  if (cancelEditProfileButton) {
    cancelEditProfileButton.addEventListener('click', function() {
      document.getElementById('editProfilePage').style.display = 'none';
      document.getElementById('homePage').style.display = 'block';
    });
  }
  if (confirmEditProfileButton) {
    confirmEditProfileButton.addEventListener('click', async function() {
      let newUsername = document.getElementById('newUsername').value.trim();
      let currentPassword = document.getElementById('currentPassword').value;
      let newPassword = document.getElementById('newPassword').value;
      let secretQuestion = document.getElementById('secretQuestion').value;
      let secretAnswer = document.getElementById('secretAnswer').value.trim();
      let phoneNumber = document.getElementById('n°phone').value.trim();
      let iban = document.getElementById('Iban').value.trim();
      if (!currentPassword) {
        setStatus("Veuillez entrer votre mot de passe actuel.", true, 'editProfileError');
        return;
      }
      if (newUsername.length < 3) {
        setStatus("L'identifiant doit faire au moins 3 caractères.", true, 'editProfileError');
        return;
      }
      if (newPassword && newPassword.length < 6) {
        setStatus("Le mot de passe doit faire au moins 6 caractères.", true, 'editProfileError');
        return;
      }
      if (secretQuestion && !secretAnswer) {
        setStatus("Veuillez entrer une réponse à votre question secrète.", true, 'editProfileError');
        return;
      }
      if (!phoneNumber) {
        setStatus("Veuillez entrer un numéro de téléphone.", true, 'editProfileError');
        return;
      }
      if (!iban) {
        setStatus("Veuillez entrer un numéro de compte (IBAN).", true, 'editProfileError');
        return;
      }
      try {
        await fetch(webAppUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "editProfile",
            username: currentUser.username,
            currentPassword: currentPassword,
            newUsername: newUsername,
            newPassword: newPassword,
            secretQuestion: secretQuestion,
            secretAnswer: secretAnswer,
            phoneNumber: phoneNumber,
            iban: iban
          })
        });
        setStatus("Profil mis à jour avec succès !", false, 'editProfileError');
        if (newUsername !== currentUser.username) {
          currentUser = { ...currentUser, username: newUsername };
          document.getElementById('employe').value = newUsername;
          document.getElementById('welcomeUsername').textContent = newUsername;
        }
        if (newPassword) {
          currentPassword = newPassword;
          if (localStorage.getItem("stayConnected") === "true") {
            localStorage.setItem("password", newPassword);
          }
        }
        setTimeout(() => {
          document.getElementById('editProfilePage').style.display = 'none';
          document.getElementById('homePage').style.display = 'block';
        }, 1500);
        await loadAllData();
      } catch (error) {
        setStatus(`Erreur: ${error.message}`, true, 'editProfileError');
      }
    });
  }

  document.getElementById('confirmAddEmployeButton').addEventListener('click', ajouterEmploye);

  // Écouteur pour le bouton "Enregistrer la commande"
  document.getElementById('enregistrer').addEventListener('click', enregistrerCommande);

  const forgotPasswordLink = document.querySelector(".forgot-password");
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  const resetPasswordBtn = document.getElementById("resetPasswordBtn");
  const cancelForgotBtn = document.getElementById("cancelForgotBtn");
  const forgotUsernameInput = document.getElementById("forgotUsername");
  const forgotSecretAnswerInput = document.getElementById("forgotSecretAnswer");
  const forgotNewPasswordInput = document.getElementById("forgotNewPassword");
  const forgotQuestionLabel = document.getElementById("forgotSecretQuestionLabel");

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("loginForm").style.display = "none";
      forgotPasswordForm.style.display = "flex";
      setStatus("", false, "forgotError");
    });
  }
  if (cancelForgotBtn) {
    cancelForgotBtn.addEventListener("click", () => {
      forgotPasswordForm.style.display = "none";
      document.getElementById("loginForm").style.display = "flex";
    });
  }
  if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener("click", async () => {
      const username = forgotUsernameInput.value.trim();
      const secretAnswer = forgotSecretAnswerInput.value.trim();
      const newPassword = forgotNewPasswordInput.value.trim();
      if (!username || !secretAnswer || !newPassword) {
        setStatus("Veuillez remplir tous les champs.", true, "forgotError");
        return;
      }
      if (newPassword.length < 6) {
        setStatus("Le mot de passe doit faire au moins 6 caractères.", true, "forgotError");
        return;
      }
      try {
        await fetch(webAppUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "resetPasswordWithSecretAnswer",
            username: username,
            answer: secretAnswer,
            newPassword: newPassword
          })
        });
        setStatus("Mot de passe réinitialisé avec succès !", false, "forgotError");
        setTimeout(() => {
          forgotPasswordForm.style.display = "none";
          document.getElementById("loginForm").style.display = "flex";
        }, 1500);
      } catch (error) {
        setStatus(`Erreur : ${error.message}`, true, "forgotError");
      }
    });
  }
  if (forgotUsernameInput) {
    forgotUsernameInput.addEventListener("blur", async function() {
      const username = this.value.trim();
      if (!username) {
        forgotQuestionLabel.textContent = "Question secrète :";
        return;
      }
      try {
        const userDetails = await fetchData("getUserByUsername", { username });
        if (userDetails.success && userDetails.user && userDetails.user.secret_question) {
          forgotQuestionLabel.textContent = `Question secrète : ${userDetails.user.secret_question}`;
        } else {
          forgotQuestionLabel.textContent = "Question non trouvée";
        }
      } catch (error) {
        forgotQuestionLabel.textContent = "Erreur de récupération";
      }
    });
  }

  updateDateInfo();
});

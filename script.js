// URL de l'API Google Apps Script
const webAppUrl = "https://script.google.com/macros/s/AKfycbx-KLhig1l6aLqe148kmCOr0jzCjf0lCNk_pidvEBtSuuRyMOzmHeXTji3PUWIbdWJo1Q/exec";

// Variables globales
let ticketUnitValue = 8;
let isMenuStandard = false;
let currentMenuPrice = 0;
let currentMenuCost = 0;
let allData = {};
let selectedClient = "";
let currentUser = null;
let currentPassword = "";

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

    // Pour les requêtes POST en mode no-cors
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
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  if (!username || !password) {
    setStatus("Veuillez remplir tous les champs.", true, 'loginError');
    return false;
  }
  setStatus("Connexion en cours...", false, 'loginError');
  currentPassword = password;
  const result = await fetchData("verifyUser", { username, password });
  if (result?.success) {
    currentUser = {
      username,
      role: result.role || "employe",
      employe: result.employe || username // Utilisez l'employé lié ou le username par défaut
    };
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('currentUserName').textContent = username;
    document.getElementById('currentUserRole').textContent = result.role || "employe";
    document.getElementById('employe').value = result.employe || username; // Remplit le champ employé
    document.getElementById('userInfo').style.display = 'block';
    await loadAllData();
    setStatus(`Connecté en tant que ${username} (${result.role || "employe"}).`);
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
  document.getElementById('loginForm').style.display = 'flex';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  setStatus("Déconnecté.", false, 'loginError');
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
  setStatus("Chargement des données...");
  const result = await fetchData("getAllData");

  if (result?.success === false) {
    setStatus(`Erreur: ${result.error || "Impossible de charger les données"}`, true);
    return;
  }

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
  setStatus("Données chargées.");
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

// Envoie la commande à l'API
async function enregistrerCommande() {
  const dateJour = document.getElementById('dateJour').value;
  const jour = document.getElementById('jourLettre').value;
  const numSemaine = document.getElementById('numSemaine').value;
  const employe = document.getElementById('employe').value;
  const contrat = document.getElementById('contrat_entreprise').value;
  const clientSelect = document.getElementById('noms_des_client');
  const client = clientSelect.value === "nouveau" ? document.getElementById('nouveauClientInput').value : clientSelect.value;
  const menu = document.getElementById('menu').value;
  const hasTicket = document.getElementById('ticket').checked;
  const ticketQty = hasTicket ? parseInt(document.getElementById('ticketNombre').value) || 0 : 0;

  if (!employe) {
    setStatus("Veuillez sélectionner un employé.", true);
    return;
  }

  if (clientSelect.value === "nouveau" && !client) {
    setStatus("Veuillez entrer un nom de client.", true);
    return;
  }

  let data;

  if (isMenuStandard) {
    data = {
      action: "enregistrerCommande",
      typeCommande: "menu",
      dateJour, jour, numSemaine, employe,
      password: currentPassword,
      contrat, client, menu,
      menuPrice: currentMenuPrice, menuCost: currentMenuCost,
      qte1: parseInt(document.querySelector('.product-quantity[data-position="1"]').value) || 1,
      plat: document.querySelector('.product-select[data-position="1"]').value,
      accompagnement: document.querySelector('.product-select[data-position="2"]').value,
      dessert: document.querySelector('.product-select[data-position="3"]').value,
      boisson: document.querySelector('.product-select[data-position="4"]').value,
      optionnel: document.querySelector('.product-select[data-position="5"]').value,
      hasTicket, ticketQty
    };
  } else {
    const products = [];

    document.querySelectorAll('.product-select').forEach(select => {
      const position = select.dataset.position;
      const input = document.querySelector(`.product-quantity[data-position="${position}"]`);

      if (select.value !== "" && parseInt(input.value) > 0) {
        products.push({
          nom: select.value,
          type: select.dataset.type,
          quantite: parseInt(input.value),
          prix: parseFloat(select.options[select.selectedIndex].dataset.price) || 0,
          cost: parseFloat(select.options[select.selectedIndex].dataset.cost) || 0
        });
      }
    });

    if (products.length === 0) {
      setStatus("Veuillez sélectionner au moins un produit.", true);
      return;
    }

    data = {
      action: "enregistrerCommande",
      typeCommande: "libre",
      dateJour, jour, numSemaine, employe,
      password: currentPassword,
      contrat, client, products, hasTicket, ticketQty
    };
  }

  setStatus("Enregistrement en cours...");

  try {
    await fetch(webAppUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    setStatus("Commande enregistrée avec succès !");
    document.getElementById('menu').value = "sans menu";
    unlockProductSelections();
    calculerTotaux();
  } catch (error) {
    setStatus(`Erreur lors de l'enregistrement: ${error.message}`, true);
  }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  // Cache le contenu principal au démarrage
  document.getElementById('appContainer').style.display = 'none';

  // Écouteurs pour le formulaire de login
  document.getElementById('loginButton').addEventListener('click', login);
  document.getElementById('logoutButton').addEventListener('click', logout);

  // Écouteurs pour le formulaire principal
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

  document.getElementById('validerNouveauClient').addEventListener('click', ajouterNouveauClient);
  document.getElementById('enregistrer').addEventListener('click', enregistrerCommande);

  // Initialise la date et charge les données
  updateDateInfo();
  loadAllData();
});

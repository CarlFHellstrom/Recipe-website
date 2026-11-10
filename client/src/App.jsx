import { useState } from 'react'
import RecipesPage from './components/RecipesPage.jsx'
import RecipeForm from './components/RecipeForm.jsx'
import IngredientsPage from './components/IngredientsPage.jsx'
import './App.css'

const TABS = [
  { id: 'recipes', label: 'Recipes' },
  { id: 'new-recipe', label: 'New recipe' },
  { id: 'ingredients', label: 'Ingredients' },
]

export default function App() {
  // view: 'recipes' | 'new-recipe' | 'ingredients' | 'edit-recipe'
  const [view, setView] = useState('recipes')
  const [editId, setEditId] = useState(null)

  const goToRecipes = () => setView('recipes')

  function startEdit(id) {
    setEditId(id)
    setView('edit-recipe')
  }

  return (
    <div className="app">
      <header>
        <h1>Recipes</h1>
        <nav>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={view === tab.id ? 'tab active' : 'tab'}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {view === 'recipes' && <RecipesPage onEdit={startEdit} />}
        {view === 'new-recipe' && <RecipeForm onSaved={goToRecipes} />}
        {view === 'edit-recipe' && (
          <RecipeForm key={editId} recipeId={editId} onSaved={goToRecipes} onCancel={goToRecipes} />
        )}
        {view === 'ingredients' && <IngredientsPage />}
      </main>
    </div>
  )
}

type Props = {
  categories: Record<string, string>;
  onSelectCategory: (category: string, folderId: string) => void;
  onAddCategory?: () => void;
};

export default function CategoryGrid({ categories, onSelectCategory, onAddCategory }: Props) {
  return (
    <div className="category-grid">
      {Object.entries(categories).map(([category, folderId]) => (
        <button
          key={category}
          className="category-tile"
          onClick={() => onSelectCategory(category, folderId)}
        >
          {category}
        </button>
      ))}
      {onAddCategory && (
        <button className="category-tile category-tile-add" onClick={onAddCategory}>
          + Add Category
        </button>
      )}
    </div>
  );
}

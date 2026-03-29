import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, writeBatch, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Category, Question } from '../types';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, FileSpreadsheet, List, AlertCircle, X, User } from 'lucide-react';

export default function AdminPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'categories'), orderBy('createdAt', 'desc')));
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as Category)));
    } catch (error) {
      console.error("Error fetching categories:", error);
      handleFirestoreError(error, OperationType.LIST, 'categories');
      toast.error("Không thể tải danh sách lĩnh vực");
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCatName,
        description: newCatDesc,
        createdAt: serverTimestamp()
      });
      setNewCatName('');
      setNewCatDesc('');
      fetchCategories();
      toast.success("Đã thêm lĩnh vực mới");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories');
      toast.error("Lỗi khi thêm lĩnh vực");
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm("Xóa lĩnh vực này sẽ không xóa các câu hỏi bên trong (bạn cần xóa câu hỏi trước). Tiếp tục?")) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
      fetchCategories();
      toast.success("Đã xóa lĩnh vực");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
      toast.error("Lỗi khi xóa lĩnh vực");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, categoryId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          toast.error("File Excel trống");
          return;
        }

        const batch = writeBatch(db);
        let count = 0;
        const validAnswers = ['A', 'B', 'C', 'D'];

        for (const row of jsonData) {
          // Normalize keys to handle case sensitivity
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase().trim()] = row[key];
          });

          const answer = (normalizedRow.answer || normalizedRow['đáp án đúng'] || "").toString().toUpperCase().trim();

          const questionData = {
            categoryId,
            question: (normalizedRow.question || normalizedRow['câu hỏi'] || "").toString(),
            a: (normalizedRow.a || normalizedRow['đáp án a'] || "").toString(),
            b: (normalizedRow.b || normalizedRow['đáp án b'] || "").toString(),
            c: (normalizedRow.c || normalizedRow['đáp án c'] || "").toString(),
            d: (normalizedRow.d || normalizedRow['đáp án d'] || "").toString(),
            answer: answer,
            createdAt: serverTimestamp()
          };

          // Strict validation before adding to batch to avoid security rule rejection
          if (questionData.question && validAnswers.includes(questionData.answer) && questionData.a) {
            const newDocRef = doc(collection(db, 'questions'));
            batch.set(newDocRef, questionData);
            count++;
          }
        }

        if (count > 0) {
          await batch.commit();
          toast.success(`Đã nạp thành công ${count} câu hỏi!`);
        } else {
          toast.error("Không tìm thấy câu hỏi hợp lệ trong file Excel");
        }
      } catch (error) {
        console.error("Error uploading questions:", error);
        handleFirestoreError(error, OperationType.WRITE, 'questions');
        toast.error("Lỗi khi xử lý file Excel");
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const clearQuestions = async (categoryId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa TẤT CẢ câu hỏi trong lĩnh vực này?")) return;
    
    setUploading(true);
    try {
      const q = query(collection(db, 'questions'), where('categoryId', '==', categoryId));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast.success(`Đã xóa ${snap.size} câu hỏi`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'questions');
      toast.error("Lỗi khi xóa câu hỏi");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-agri-red"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <User size={14} />
          <span>Đang đăng nhập: <b>{auth.currentUser?.email}</b></span>
        </div>
        {auth.currentUser?.email !== "minhtanst95@gmail.com" && (
          <span className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded font-bold uppercase">Không có quyền Admin</span>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-black text-agri-red uppercase mb-4 flex items-center gap-2">
          <Plus size={20} />
          Thêm lĩnh vực mới
        </h2>
        <div className="space-y-3">
          <input 
            type="text" 
            placeholder="Tên lĩnh vực (VD: Nghiệp vụ Tín dụng)" 
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="w-full border-b-2 border-gray-100 p-2 outline-none focus:border-agri-red font-bold"
          />
          <input 
            type="text" 
            placeholder="Mô tả ngắn gọn" 
            value={newCatDesc}
            onChange={(e) => setNewCatDesc(e.target.value)}
            className="w-full border-b-2 border-gray-100 p-2 outline-none focus:border-agri-red text-sm"
          />
          <button 
            onClick={addCategory}
            disabled={!newCatName.trim()}
            className="w-full bg-agri-green text-white py-3 rounded-xl font-bold disabled:opacity-30 transition active:scale-95"
          >
            Lưu lĩnh vực
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-700 uppercase px-2 flex items-center gap-2">
          <List size={20} />
          Danh sách lĩnh vực ({categories.length})
        </h2>
        
        {categories.map(cat => (
          <div key={cat.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-agri-green text-lg">{cat.name}</h3>
                <p className="text-xs text-gray-400">{cat.description || 'Không có mô tả'}</p>
              </div>
              <button 
                onClick={() => deleteCategory(cat.id)}
                className="p-2 text-red-300 hover:text-red-500 transition"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-3 rounded-xl text-xs font-bold cursor-pointer hover:bg-blue-100 transition">
                <Upload size={14} />
                NẠP EXCEL
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                  onChange={(e) => handleFileUpload(e, cat.id)}
                  disabled={uploading}
                />
              </label>
              <button 
                onClick={() => clearQuestions(cat.id)}
                disabled={uploading}
                className="flex items-center justify-center gap-2 bg-red-50 text-red-600 py-3 rounded-xl text-xs font-bold hover:bg-red-100 transition"
              >
                <Trash2 size={14} />
                XÓA CÂU HỎI
              </button>
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <AlertCircle size={48} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Chưa có lĩnh vực nào được tạo</p>
          </div>
        )}
      </div>

      {uploading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white p-6 rounded-2xl flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-agri-red"></div>
            <p className="font-bold text-sm">Đang xử lý dữ liệu...</p>
          </div>
        </div>
      )}

      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
        <FileSpreadsheet className="text-amber-500 shrink-0" size={20} />
        <div className="text-[10px] text-amber-700 leading-relaxed">
          <p className="font-bold uppercase mb-1">Định dạng file Excel yêu cầu:</p>
          <p>Các cột: <b>Question</b> (Câu hỏi), <b>A</b>, <b>B</b>, <b>C</b>, <b>D</b>, <b>Answer</b> (Đáp án đúng: A, B, C hoặc D).</p>
          <p className="mt-1 italic">* Tên cột không phân biệt hoa thường.</p>
        </div>
      </div>
    </div>
  );
}

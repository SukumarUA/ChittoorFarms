import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Edit, Trash2, X, Image as ImageIcon, Upload, Megaphone, PlusCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

const farmerImageFallback = '/CTRFLOGO.jpeg';
const useFarmerImageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.onerror = null;
  event.currentTarget.src = farmerImageFallback;
};

interface Farm {
  id: string;
  farm_name: string;
  farmer_name: string;
  phone: string;
  location: string;
  varieties: string;
  acres: number;
  since_year: number;
  story: string;
  photo_url: string;
  instagram_url: string | null;
  youtube_url: string | null;
  instagram_urls: string[];
  youtube_urls: string[];
  farm_update: string | null;
  feature_update_on_notice_board: boolean;
  farm_type: string | null;
  district: string | null;
  mandal: string | null;
  village: string | null;
  pincode: string | null;
  sort_order: number;
  active: boolean;
}

export const FarmsManager: React.FC = () => {
  const { showToast } = useToast();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  // Form & Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Farm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [farmName, setFarmName] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [phone, setPhone] = useState('');
  const [farmTypes, setFarmTypes] = useState<string[]>([]);
  const [farmType, setFarmType] = useState('');
  const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [village, setVillage] = useState('');
  const [pincode, setPincode] = useState('');
  const [varieties, setVarieties] = useState('');
  const [acres, setAcres] = useState('');
  const [sinceYear, setSinceYear] = useState('');
  const [story, setStory] = useState('');
  const [instagramUrls, setInstagramUrls] = useState<string[]>(['']);
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>(['']);
  const [farmUpdate, setFarmUpdate] = useState('');
  const [featureUpdateOnNoticeBoard, setFeatureUpdateOnNoticeBoard] = useState(false);
  const [sortOrder, setSortOrder] = useState('');
  const [active, setActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Farm | null>(null);

  const fetchFarms = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFarms(data || []);
    } catch (err) {
      console.error('Error fetching farms:', err);
      showToast('Failed to load farms list.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void Promise.resolve().then(fetchFarms);
    supabase.from('settings').select('farm_types').eq('id', 'main').single().then(({ data }) => {
      setFarmTypes(Array.isArray(data?.farm_types) ? data.farm_types : []);
    });
  }, [fetchFarms]);

  const handleOpenAdd = () => {
    setEditTarget(null);
    setFarmName('');
    setFarmerName('');
    setPhone('');
    setFarmType(''); setDistrict(''); setMandal(''); setVillage(''); setPincode('');
    setVarieties('');
    setAcres('');
    setSinceYear('');
    setStory('');
    setInstagramUrls(['']);
    setYoutubeUrls(['']);
    setFarmUpdate('');
    setFeatureUpdateOnNoticeBoard(false);
    setSortOrder('');
    setActive(true);
    setImageFile(null);
    setImagePreviewUrl('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (farm: Farm) => {
    setEditTarget(farm);
    setFarmName(farm.farm_name);
    setFarmerName(farm.farmer_name);
    setPhone(farm.phone);
    setFarmType(farm.farm_type || ''); setDistrict(farm.district || ''); setMandal(farm.mandal || ''); setVillage(farm.village || ''); setPincode(farm.pincode || '');
    setVarieties(farm.varieties);
    setAcres(farm.acres?.toString() || '');
    setSinceYear(farm.since_year?.toString() || '');
    setStory(farm.story);
    setInstagramUrls(farm.instagram_urls?.length ? farm.instagram_urls : (farm.instagram_url ? [farm.instagram_url] : ['']));
    setYoutubeUrls(farm.youtube_urls?.length ? farm.youtube_urls : (farm.youtube_url ? [farm.youtube_url] : ['']));
    setFarmUpdate(farm.farm_update || '');
    setFeatureUpdateOnNoticeBoard(farm.feature_update_on_notice_board);
    setSortOrder(farm.sort_order != null ? farm.sort_order.toString() : '');
    setActive(farm.active);
    setImageFile(null);
    setImagePreviewUrl(farm.photo_url || '');
    setIsModalOpen(true);
  };

  // Inline Active state toggle
  const handleToggleActive = async (id: string, currentVal: boolean) => {
    try {
      const { error } = await supabase
        .from('farms')
        .update({ active: !currentVal })
        .eq('id', id);

      if (error) throw error;

      setFarms((prev) =>
        prev.map((f) => (f.id === id ? { ...f, active: !currentVal } : f))
      );
      showToast(`Farm set to ${!currentVal ? 'Active' : 'Inactive'}.`, 'success');
    } catch (err) {
      console.error('Toggle active error:', err);
      showToast('Failed to update farm visibility.', 'error');
    }
  };

  const handleToggleNoticeBoard = async (farm: Farm) => {
    if (!farm.farm_update?.trim() && !farm.feature_update_on_notice_board) {
      showToast('Add an update to this farm before featuring it on the homepage.', 'error');
      return;
    }

    const nextValue = !farm.feature_update_on_notice_board;
    try {
      const { error } = await supabase
        .from('farms')
        .update({ feature_update_on_notice_board: nextValue })
        .eq('id', farm.id);

      if (error) throw error;
      setFarms((previous) => previous.map((item) => (
        item.id === farm.id ? { ...item, feature_update_on_notice_board: nextValue } : item
      )));
      showToast(`Farm update ${nextValue ? 'added to' : 'removed from'} the homepage notice board.`, 'success');
    } catch (err) {
      console.error('Toggle farm notice error:', err);
      showToast('Failed to update homepage notice visibility.', 'error');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  // Upload file helper
  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `farms/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chittoor-farms')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('chittoor-farms').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // Submit Add/Edit form
  const handleSaveFarm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!farmName.trim() || !farmerName.trim() || !phone || !farmType || !district.trim() || !mandal.trim() || !village.trim() || !pincode.trim() || !varieties.trim() || !story.trim()) {
      showToast('Please fill all required fields.', 'error');
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      showToast('Please enter a valid 6-digit pincode.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      let finalImageUrl = imagePreviewUrl;

      // Upload image if a new one is selected
      if (imageFile) {
        finalImageUrl = await uploadImage(imageFile);
      }

      const farmPayload = {
        farm_name: farmName.trim(),
        farmer_name: farmerName.trim(),
        phone: phone.replace(/\D/g, ''),
        location: [village, mandal, district].map((item) => item.trim()).filter(Boolean).join(', '),
        farm_type: farmType,
        district: district.trim(),
        mandal: mandal.trim(),
        village: village.trim(),
        pincode: pincode.trim(),
        varieties: varieties.trim(),
        acres: acres ? parseFloat(acres) : null,
        since_year: sinceYear ? parseInt(sinceYear) : null,
        story: story.trim(),
        sort_order: sortOrder.trim() !== '' ? parseInt(sortOrder) : null,
        active,
        photo_url: finalImageUrl || null,
        instagram_urls: instagramUrls.map((u) => u.trim()).filter(Boolean),
        youtube_urls: youtubeUrls.map((u) => u.trim()).filter(Boolean),
        // Keep legacy single columns in sync (first URL or null)
        instagram_url: instagramUrls.find((u) => u.trim()) || null,
        youtube_url: youtubeUrls.find((u) => u.trim()) || null,
        farm_update: farmUpdate.trim() || null,
        feature_update_on_notice_board: Boolean(farmUpdate.trim()) && featureUpdateOnNoticeBoard,
      };

      if (editTarget) {
        // Edit existing farm profile
        const { error } = await supabase
          .from('farms')
          .update(farmPayload)
          .eq('id', editTarget.id);

        if (error) throw error;
        showToast('Farm profile updated successfully.', 'success');
      } else {
        // Add new farm profile
        const { error } = await supabase
          .from('farms')
          .insert([farmPayload]);

        if (error) throw error;
        showToast('Farm profile registered successfully.', 'success');
      }

      setIsModalOpen(false);
      fetchFarms();
    } catch (err: unknown) {
      console.error('Error saving farm:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save farm details.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const { error } = await supabase
        .from('farms')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      showToast('Farm profile removed successfully.', 'success');
      setDeleteTarget(null);
      fetchFarms();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete farm.', 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Manage Partner Farms</h2>
        <button className="btn btn-secondary" style={{ display: 'flex', gap: '0.25rem' }} onClick={handleOpenAdd}>
          <Plus size={16} />
          <span>Add Farm</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🔄 Loading farms directory...
        </div>
      ) : farms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No partner farms listed yet. Click "Add Farm" to create one.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Farm Name</th>
                <th>Type</th>
                <th>Farmer Name</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Acres</th>
                <th>Varieties</th>
                <th style={{ width: '120px' }}>Homepage Update</th>
                <th style={{ width: '100px' }}>Active</th>
                <th>Sort Order</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {farms.map((farm) => (
                <tr key={farm.id}>
                  {/* Photo Thumbnail */}
                  <td>
                    <img
                      src={farm.photo_url || farmerImageFallback}
                      alt={farm.farm_name}
                      style={{ width: '55px', height: '55px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', background: 'var(--bg-muted)' }}
                      onError={useFarmerImageFallback}
                    />
                  </td>

                  {/* Names */}
                  <td style={{ fontWeight: 600 }}>{farm.farm_name}</td>
                  <td>{farm.farm_type || 'Not set'}</td>
                  <td>{farm.farmer_name}</td>

                  {/* Phone */}
                  <td>
                    <a href={`tel:${farm.phone}`}>{farm.phone}</a>
                  </td>

                  {/* Location */}
                  <td>{farm.location}</td>

                  {/* Size */}
                  <td style={{ fontWeight: 600 }}>{farm.acres ? `${farm.acres} Ac` : 'N/A'}</td>

                  {/* Varieties list */}
                  <td style={{ fontSize: '0.8rem', maxWidth: '180px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={farm.varieties}>
                    {farm.varieties}
                  </td>

                  <td>
                    <label className="toggle-switch" title={farm.farm_update ? 'Feature this update on the homepage notice board' : 'Add a farm update first'}>
                      <input
                        type="checkbox"
                        checked={farm.feature_update_on_notice_board}
                        onChange={() => handleToggleNoticeBoard(farm)}
                        disabled={!farm.farm_update?.trim()}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </td>

                  {/* Active Toggle Switch */}
                  <td>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={farm.active}
                        onChange={() => handleToggleActive(farm.id, farm.active)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </td>

                  {/* Sort Order */}
                  <td style={{ paddingLeft: '2rem' }}>{farm.sort_order}</td>

                  {/* Actions */}
                  <td>
                    <div className="admin-table-actions">
                      <button
                        className="btn btn-outline btn-icon"
                        style={{ width: '32px', height: '32px' }}
                        onClick={() => handleOpenEdit(farm)}
                        title="Edit Farm Profile"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        className="btn btn-outline btn-icon"
                        style={{ width: '32px', height: '32px', color: 'var(--danger)', borderColor: 'var(--border-color)' }}
                        onClick={() => setDeleteTarget(farm)}
                        title="Delete Farm Profile"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop open" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editTarget ? 'Edit Partner Farm' : 'Onboard Partner Farm'}</h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFarm}>
              <div className="modal-body">
                {/* Photo Upload Area */}
                <div className="form-group">
                  <label>Farmer / Farm Photo</label>
                  <label htmlFor="farmImageFile">
                    <div
                      className="image-upload-preview"
                      style={{
                        backgroundImage: imagePreviewUrl ? `url(${imagePreviewUrl})` : 'none',
                      }}
                    >
                      {!imagePreviewUrl && (
                        <>
                          <ImageIcon size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click to upload farmer or farm photo</span>
                        </>
                      )}
                      {imagePreviewUrl && (
                        <div className="image-upload-overlay">
                          <Upload size={20} style={{ marginRight: '0.25rem' }} />
                          <span>Change Photo</span>
                        </div>
                      )}
                    </div>
                  </label>
                  <input
                    type="file"
                    id="farmImageFile"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fmName">Farm Property Name *</label>
                  <input
                    type="text"
                    id="fmName"
                    className="form-control"
                    placeholder="e.g. Sri Venkateswara Gardens"
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fmType">Type of Farm *</label>
                  <select id="fmType" className="form-control" value={farmType} onChange={(e) => setFarmType(e.target.value)} required>
                    <option value="">Select farm type</option>
                    {farmType && !farmTypes.includes(farmType) && <option value={farmType}>{farmType}</option>}
                    {farmTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <small>Farm types are managed in CMS.</small>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="fmFarmer">Farmer / Caretaker Name *</label>
                    <input
                      type="text"
                      id="fmFarmer"
                      className="form-control"
                      placeholder="e.g. K. Ananda Naidu"
                      value={farmerName}
                      onChange={(e) => setFarmerName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="fmPhone">Contact Number *</label>
                    <input
                      type="tel"
                      id="fmPhone"
                      className="form-control"
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row"><div className="form-group"><label>District *</label><input className="form-control" value={district} onChange={(e) => setDistrict(e.target.value)} required /></div><div className="form-group"><label>Mandal *</label><input className="form-control" value={mandal} onChange={(e) => setMandal(e.target.value)} required /></div></div>
                <div className="form-row"><div className="form-group"><label>Village *</label><input className="form-control" value={village} onChange={(e) => setVillage(e.target.value)} required /></div><div className="form-group"><label>Pincode *</label><input className="form-control" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))} required /></div></div>

                <div className="form-group">
                  <label htmlFor="fmVarieties">Produce, Breeds or Varieties (comma-separated) *</label>
                  <input
                    type="text"
                    id="fmVarieties"
                    className="form-control"
                    placeholder="e.g. Mangoes, Sona Masoori rice, dairy milk"
                    value={varieties}
                    onChange={(e) => setVarieties(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="fmAcres">Farm Size (Acres)</label>
                    <input
                      type="number"
                      step="0.1"
                      id="fmAcres"
                      className="form-control"
                      placeholder="e.g. 12.5"
                      value={acres}
                      onChange={(e) => setAcres(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="fmSince">Farming Since (Year)</label>
                    <input
                      type="number"
                      id="fmSince"
                      className="form-control"
                      placeholder="e.g. 1994"
                      value={sinceYear}
                      onChange={(e) => setSinceYear(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="fmStory">Farmer's Story / Narrative *</label>
                  <textarea
                    id="fmStory"
                    className="form-control"
                    placeholder="Provide a story about the farm's irrigation methods, family history, and organic practices..."
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                <div className="farm-update-admin-panel">
                  <div className="farm-update-admin-heading">
                    <Megaphone size={19} />
                    <div>
                      <strong>Updates from Farm</strong>
                      <small>Share a current harvest, orchard, visit, or availability update.</small>
                    </div>
                  </div>
                  <textarea
                    id="fmUpdate"
                    className="form-control"
                    placeholder="e.g. Banganapalli picking begins this Friday. Pre-orders are now open."
                    value={farmUpdate}
                    onChange={(e) => {
                      setFarmUpdate(e.target.value);
                      if (!e.target.value.trim()) setFeatureUpdateOnNoticeBoard(false);
                    }}
                    rows={3}
                    maxLength={280}
                  />
                  <div className="farm-update-admin-footer">
                    <span>{farmUpdate.length}/280</span>
                    <label className="farm-update-feature-option">
                      <input
                        type="checkbox"
                        checked={featureUpdateOnNoticeBoard}
                        disabled={!farmUpdate.trim()}
                        onChange={(e) => setFeatureUpdateOnNoticeBoard(e.target.checked)}
                      />
                      <span>Feature this update on the homepage notice board</span>
                    </label>
                  </div>
                </div>

                {/* Instagram URLs — multiple */}
                <div className="form-group">
                  <label>Instagram Post / Reel URLs</label>
                  {instagramUrls.map((url, idx) => (
                    <div key={idx} className="media-url-row">
                      <input
                        type="url"
                        className="form-control"
                        placeholder="https://www.instagram.com/p/..."
                        value={url}
                        onChange={(e) => {
                          const next = [...instagramUrls];
                          next[idx] = e.target.value;
                          setInstagramUrls(next);
                        }}
                      />
                      {instagramUrls.length > 1 && (
                        <button
                          type="button"
                          className="btn-icon media-url-remove"
                          onClick={() => setInstagramUrls(instagramUrls.filter((_, i) => i !== idx))}
                          title="Remove"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-outline media-url-add"
                    onClick={() => setInstagramUrls([...instagramUrls, ''])}
                  >
                    <PlusCircle size={15} /> Add Instagram URL
                  </button>
                </div>

                {/* YouTube URLs — multiple */}
                <div className="form-group">
                  <label>YouTube Video URLs</label>
                  {youtubeUrls.map((url, idx) => (
                    <div key={idx} className="media-url-row">
                      <input
                        type="url"
                        className="form-control"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={url}
                        onChange={(e) => {
                          const next = [...youtubeUrls];
                          next[idx] = e.target.value;
                          setYoutubeUrls(next);
                        }}
                      />
                      {youtubeUrls.length > 1 && (
                        <button
                          type="button"
                          className="btn-icon media-url-remove"
                          onClick={() => setYoutubeUrls(youtubeUrls.filter((_, i) => i !== idx))}
                          title="Remove"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-outline media-url-add"
                    onClick={() => setYoutubeUrls([...youtubeUrls, ''])}
                  >
                    <PlusCircle size={15} /> Add YouTube URL
                  </button>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="fmSort">Display Sort Order</label>
                    <input
                      type="number"
                      id="fmSort"
                      className="form-control"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                    <input
                      type="checkbox"
                      id="fmActive"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="fmActive" style={{ cursor: 'pointer' }}>Active (Visible on public Our Farms page)</label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-secondary" disabled={isSaving}>
                  {isSaving ? 'Onboarding...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop open" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none' }}>
              <h3 style={{ color: 'var(--danger)' }}>Delete Farm Profile?</h3>
            </div>
            <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
              Are you sure you want to permanently delete <strong>{deleteTarget.farm_name}</strong>? This profile will be deleted from the database.
            </div>
            <div className="modal-footer" style={{ borderTop: 'none' }}>
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
